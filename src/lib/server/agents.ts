import "server-only";
import { z } from "zod";
import { contextBudgetChars, generateStructured } from "@/lib/server/llm";
import { appearsIn, normalizeForMatch } from "@/lib/text";
import type {
  BloomLevel,
  ContentAnalysis,
  CurriculumProfile,
  DocumentSection,
  FinalReport,
  LanguageIssue,
  Standard,
  StandardAlignment,
} from "@/types/review";

// Each agent owns one stage of the review. Agents never see each other's
// prompts; they communicate only through the typed results the pipeline
// stores, which keeps every stage independently testable and re-runnable.
//
// Shared rule for every agent: quote the document verbatim and never invent
// content. The pipeline then checks quotes against the source text and flags
// anything that cannot be found, so reviewers can see what is verified.

const GROUNDING_RULES = `Ground every finding in the supplied text. When you quote the document, copy the words exactly as they appear (same spelling, same diacritics). Never invent content, page numbers, or sources. If the text does not contain enough information to judge something, say so plainly instead of guessing.
Write all human-readable fields (explanations, findings, recommendations, summaries) in the same language as the curriculum document.`;

// ---------------------------------------------------------------------------
// Helpers

/** Run async work over items with bounded concurrency. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const CONCURRENCY = Math.max(1, Number(process.env.AGENT_CONCURRENCY) || 3);

/** Group sections into batches that fit the model's input budget. */
function batchSections(sections: DocumentSection[], budget: number): DocumentSection[][] {
  const batches: DocumentSection[][] = [];
  let current: DocumentSection[] = [];
  let size = 0;
  for (const section of sections) {
    if (current.length && size + section.text.length > budget) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(section);
    size += section.text.length;
  }
  if (current.length) batches.push(current);
  return batches;
}

function renderSections(sections: DocumentSection[]): string {
  return sections
    .map(
      (section) =>
        `<section index="${section.index}"${section.heading ? ` heading="${section.heading.replace(/"/g, "'")}"` : ""}>\n${section.text}\n</section>`,
    )
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Agent 1 - Ingestion: understand what the document is.

const ProfileSchema = z.object({
  subject: z.string(),
  gradeLevel: z.string(),
  language: z.string(),
  summary: z.string(),
  learningObjectives: z.array(z.string()),
  unitTitles: z.array(z.string()),
});

export async function ingestionAgent(sections: DocumentSection[]): Promise<CurriculumProfile> {
  // The profile only needs an overview, so cap how much text we send.
  const budget = Math.min(contextBudgetChars(), 60_000);
  const overview = batchSections(sections, budget)[0] ?? [];
  return generateStructured({
    agent: "Ingestion agent",
    effort: "low",
    schema: ProfileSchema,
    system: `You are the ingestion agent in a curriculum review pipeline. Read the beginning of a curriculum document and describe it.
- subject: the subject/course name.
- gradeLevel: the grade, level, or audience; "unspecified" if not stated.
- language: the main language of the document (e.g. "Arabic", "English").
- summary: 2-4 sentences on scope and structure.
- learningObjectives: the learning objectives/outcomes exactly as stated in the text (verbatim; empty if none are stated).
- unitTitles: unit/chapter/lesson titles in order.
${GROUNDING_RULES}`,
    user: `Document (${sections.length} sections total; the first ${overview.length} are shown):\n\n${renderSections(overview)}`,
  });
}

// ---------------------------------------------------------------------------
// Agent 2 - Language: spelling, grammar, punctuation, terminology.

const LanguageSchema = z.object({
  issues: z.array(
    z.object({
      sectionIndex: z.number().int(),
      type: z.enum(["spelling", "grammar", "punctuation", "style", "terminology"]),
      original: z.string(),
      suggestion: z.string(),
      explanation: z.string(),
      severity: z.enum(["low", "medium", "high"]),
    }),
  ),
});

export async function languageAgent(
  sections: DocumentSection[],
  onProgress: (note: string) => Promise<void>,
): Promise<LanguageIssue[]> {
  // Smaller batches than other agents: proofreading quality drops on long inputs.
  const batches = batchSections(sections, Math.min(contextBudgetChars(), 12_000));
  let completed = 0;

  const perBatch = await mapLimit(batches, CONCURRENCY, async (batch) => {
    const result = await generateStructured({
      agent: "Language agent",
      effort: "medium",
      schema: LanguageSchema,
      system: `You are the language-quality agent in a curriculum review pipeline. Proofread the sections you are given and report real errors only:
- spelling: misspelled words, wrong hamza/taa marbuta/alif maqsura in Arabic, typos.
- grammar: agreement, case endings where clearly wrong, verb forms, sentence structure.
- punctuation: missing or wrong punctuation that affects meaning or readability.
- terminology: a subject term used inconsistently or incorrectly for the subject.
- style: only when wording is genuinely unclear for the target learners.
For each issue: sectionIndex (from the section tag), original (the exact erroneous words copied verbatim, short - just the phrase), suggestion (the corrected text), explanation (one sentence), severity (high = changes meaning or is a clear error learners would copy; medium = clear error; low = minor).
Do not report stylistic preferences, dialect-neutral alternatives, or text that is already correct. An empty list is a valid answer.
${GROUNDING_RULES}`,
      user: renderSections(batch),
    });
    completed++;
    await onProgress(`${completed}/${batches.length}`);
    return result.issues.map((issue): LanguageIssue => {
      const section = batch.find((s) => s.index === issue.sectionIndex) ?? batch[0];
      return {
        ...issue,
        sectionIndex: section.index,
        verified: appearsIn(issue.original, section.text),
      };
    });
  });

  // Drop no-op "corrections" where suggestion equals original.
  return perBatch
    .flat()
    .filter((issue) => normalizeForMatch(issue.original) !== normalizeForMatch(issue.suggestion));
}

// ---------------------------------------------------------------------------
// Agent 3 - Standards alignment.

const AlignmentSchema = z.object({
  results: z.array(
    z.object({
      code: z.string(),
      status: z.enum(["met", "partial", "not_met"]),
      evidence: z.array(z.string()),
      gap: z.string(),
      recommendation: z.string(),
    }),
  ),
});

const STANDARDS_PER_CALL = 12;

export async function standardsAgent(
  sections: DocumentSection[],
  standards: Standard[],
  profile: CurriculumProfile | null,
  onProgress: (note: string) => Promise<void>,
): Promise<StandardAlignment[]> {
  const fullText = sections.map((s) => s.text).join("\n\n");
  const budget = contextBudgetChars();
  if (fullText.length > budget) {
    throw new Error(
      `Document is ${fullText.length.toLocaleString()} characters, above this model's ${budget.toLocaleString()}-character budget for standards alignment. Split the document or raise LLM_CONTEXT_CHARS if your model supports more context.`,
    );
  }

  const groups: Standard[][] = [];
  for (let i = 0; i < standards.length; i += STANDARDS_PER_CALL) {
    groups.push(standards.slice(i, i + STANDARDS_PER_CALL));
  }
  let completed = 0;

  const perGroup = await mapLimit(groups, CONCURRENCY, async (group) => {
    const result = await generateStructured({
      agent: "Standards agent",
      effort: "high",
      schema: AlignmentSchema,
      system: `You are the standards-alignment agent in a curriculum review pipeline. For each standard, decide how well the curriculum document addresses it.
- met: the document clearly teaches and/or assesses what the standard requires.
- partial: the standard is touched on but incompletely (missing depth, missing assessment, only part of the standard).
- not_met: no meaningful coverage.
For each standard return: code (exactly as given), status, evidence (up to 3 short verbatim quotes from the document that support your judgement; empty if not_met), gap (what is missing; empty if met), recommendation (a concrete change to close the gap; empty if met).
Judge strictly: a keyword match alone is not coverage.
${GROUNDING_RULES}`,
      user: `${profile ? `Curriculum: ${profile.subject} - ${profile.gradeLevel}\n\n` : ""}<standards>\n${group
        .map((s) => `${s.code}: ${s.description}`)
        .join("\n")}\n</standards>\n\n<document>\n${fullText}\n</document>`,
    });
    completed++;
    await onProgress(`${completed}/${groups.length}`);

    // Return one result per requested standard, in order, even if the model skipped one.
    return group.map((standard): StandardAlignment => {
      const found = result.results.find((r) => r.code.trim() === standard.code.trim());
      if (!found) {
        return {
          code: standard.code,
          description: standard.description,
          status: "not_met",
          evidence: [],
          evidenceVerified: false,
          gap: "The agent returned no judgement for this standard; review manually.",
          recommendation: "",
        };
      }
      const verifiedEvidence = found.evidence.filter((quote) => appearsIn(quote, fullText));
      return {
        code: standard.code,
        description: standard.description,
        status: found.status,
        evidence: found.evidence,
        evidenceVerified: found.evidence.length > 0 && verifiedEvidence.length === found.evidence.length,
        gap: found.gap,
        recommendation: found.recommendation,
      };
    });
  });

  return perGroup.flat();
}

// ---------------------------------------------------------------------------
// Agent 4 - Content analysis.

const DIMENSIONS = [
  { key: "accuracy", label: "الدقة العلمية / Scientific accuracy" },
  { key: "objectives", label: "وضوح الأهداف وقابليتها للقياس / Clear, measurable objectives" },
  { key: "coherence", label: "التسلسل والترابط / Sequencing and coherence" },
  { key: "depth", label: "العمق والملاءمة للمرحلة / Depth and level appropriateness" },
  { key: "assessment", label: "مواءمة التقويم / Assessment alignment" },
  { key: "engagement", label: "الأنشطة والتعلم النشط / Activities and active learning" },
  { key: "inclusivity", label: "الشمول والحياد / Inclusivity and bias" },
  { key: "relevance", label: "الارتباط بالواقع ومهارات القرن 21 / Real-world relevance and 21st-century skills" },
] as const;

const ContentSchema = z.object({
  dimensions: z.array(
    z.object({
      key: z.string(),
      score: z.number(),
      findings: z.array(z.string()),
      recommendations: z.array(z.string()),
    }),
  ),
  bloomCounts: z.object({
    remember: z.number(),
    understand: z.number(),
    apply: z.number(),
    analyze: z.number(),
    evaluate: z.number(),
    create: z.number(),
  }),
  accuracyConcerns: z.array(
    z.object({ claim: z.string(), concern: z.string(), sectionIndex: z.number().int() }),
  ),
  strengths: z.array(z.string()),
});

export async function contentAgent(
  sections: DocumentSection[],
  profile: CurriculumProfile | null,
  onProgress: (note: string) => Promise<void>,
): Promise<ContentAnalysis> {
  const batches = batchSections(sections, contextBudgetChars());
  let completed = 0;

  const partials = await mapLimit(batches, CONCURRENCY, async (batch) => {
    const result = await generateStructured({
      agent: "Content agent",
      effort: "high",
      schema: ContentSchema,
      system: `You are the content-analysis agent in a curriculum review pipeline, acting as an experienced curriculum specialist.
Evaluate the document on these dimensions, scoring each 0-100 (100 = exemplary), with specific findings and actionable recommendations:
${DIMENSIONS.map((d) => `- ${d.key}: ${d.label}`).join("\n")}
Also:
- bloomCounts: classify every learning objective, activity and assessment item you can identify by Bloom's revised taxonomy level and count them per level.
- accuracyConcerns: statements that look factually wrong, outdated, or misleading for the subject. Quote the claim verbatim; give the sectionIndex. Only flag genuine concerns you can explain.
- strengths: what the curriculum does well.
${batches.length > 1 ? "You are seeing one part of a longer document; judge only what you see." : ""}
${GROUNDING_RULES}`,
      user: `${profile ? `Curriculum: ${profile.subject} - ${profile.gradeLevel}\nStated objectives:\n${profile.learningObjectives.map((o) => `- ${o}`).join("\n") || "(none stated)"}\n\n` : ""}${renderSections(batch)}`,
    });
    completed++;
    await onProgress(`${completed}/${batches.length}`);
    return { result, weight: batch.reduce((sum, s) => sum + s.text.length, 0) };
  });

  return mergeContent(partials, sections);
}

function mergeContent(
  partials: { result: z.infer<typeof ContentSchema>; weight: number }[],
  sections: DocumentSection[],
): ContentAnalysis {
  const fullText = sections.map((s) => s.text).join("\n\n");

  const dimensions = DIMENSIONS.map((dimension) => {
    let weighted = 0;
    let weightSeen = 0;
    const findings: string[] = [];
    const recommendations: string[] = [];
    for (const { result, weight } of partials) {
      const match = result.dimensions.find((d) => d.key === dimension.key);
      if (!match) continue;
      weighted += clampScore(match.score) * weight;
      weightSeen += weight;
      findings.push(...match.findings);
      recommendations.push(...match.recommendations);
    }
    return {
      key: dimension.key,
      label: dimension.label,
      score: weightSeen ? Math.round(weighted / weightSeen) : 0,
      findings: dedupe(findings),
      recommendations: dedupe(recommendations),
    };
  });

  const bloomDistribution = {} as Record<BloomLevel, number>;
  for (const level of ["remember", "understand", "apply", "analyze", "evaluate", "create"] as const) {
    bloomDistribution[level] = partials.reduce(
      (sum, p) => sum + Math.max(0, Math.round(p.result.bloomCounts[level])),
      0,
    );
  }

  return {
    dimensions,
    bloomDistribution,
    // Keep only concerns whose quoted claim is actually in the document.
    accuracyConcerns: partials
      .flatMap((p) => p.result.accuracyConcerns)
      .filter((concern) => appearsIn(concern.claim, fullText)),
    strengths: dedupe(partials.flatMap((p) => p.result.strengths)),
  };
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeForMatch(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Agent 5 - Report: synthesise findings for decision makers.

const ReportSchema = z.object({
  executiveSummary: z.string(),
  keyFindings: z.array(z.string()),
  recommendations: z.array(
    z.object({
      priority: z.enum(["high", "medium", "low"]),
      area: z.string(),
      action: z.string(),
    }),
  ),
});

/** Scores are computed deterministically from agent outputs, not asked of the model. */
export function computeScores(input: {
  wordCount: number;
  languageIssues: LanguageIssue[] | null;
  alignment: StandardAlignment[] | null;
  content: ContentAnalysis | null;
}): FinalReport["scores"] & { overall: number } {
  let language: number | null = null;
  if (input.languageIssues) {
    const weights = { high: 3, medium: 2, low: 1 } as const;
    const penalty = input.languageIssues.reduce((sum, issue) => sum + weights[issue.severity], 0);
    // Weighted errors per 1,000 words; 10+ weighted errors per 1k words scores 0.
    const per1k = penalty / Math.max(1, input.wordCount / 1000);
    language = Math.round(Math.max(0, 100 - per1k * 10));
  }

  let standards: number | null = null;
  if (input.alignment && input.alignment.length) {
    const points = { met: 1, partial: 0.5, not_met: 0 } as const;
    standards = Math.round(
      (input.alignment.reduce((sum, a) => sum + points[a.status], 0) / input.alignment.length) * 100,
    );
  }

  let content: number | null = null;
  if (input.content && input.content.dimensions.length) {
    content = Math.round(
      input.content.dimensions.reduce((sum, d) => sum + d.score, 0) / input.content.dimensions.length,
    );
  }

  // Overall: weighted mean of whatever stages produced a score.
  const parts: [number | null, number][] = [
    [language, 0.2],
    [standards, 0.4],
    [content, 0.4],
  ];
  const available = parts.filter((p): p is [number, number] => p[0] !== null);
  const weightSum = available.reduce((sum, [, w]) => sum + w, 0);
  const overall = weightSum
    ? Math.round(available.reduce((sum, [score, w]) => sum + score * w, 0) / weightSum)
    : 0;

  return { language, standards, content, overall };
}

export async function reportAgent(input: {
  profile: CurriculumProfile | null;
  frameworkName: string | null;
  wordCount: number;
  languageIssues: LanguageIssue[] | null;
  alignment: StandardAlignment[] | null;
  content: ContentAnalysis | null;
  failedStages: string[];
}): Promise<FinalReport> {
  const scores = computeScores(input);

  const languageSummary = input.languageIssues
    ? {
        total: input.languageIssues.length,
        byType: countBy(input.languageIssues, (i) => i.type),
        bySeverity: countBy(input.languageIssues, (i) => i.severity),
        examples: input.languageIssues
          .filter((i) => i.severity === "high")
          .slice(0, 10)
          .map((i) => `${i.original} -> ${i.suggestion}`),
      }
    : "stage failed or skipped";

  const alignmentSummary = input.alignment
    ? {
        framework: input.frameworkName,
        counts: countBy(input.alignment, (a) => a.status),
        gaps: input.alignment
          .filter((a) => a.status !== "met")
          .map((a) => ({ code: a.code, status: a.status, gap: a.gap })),
      }
    : "stage failed or skipped";

  const contentSummary = input.content
    ? {
        dimensions: input.content.dimensions.map((d) => ({
          dimension: d.label,
          score: d.score,
          findings: d.findings.slice(0, 5),
          recommendations: d.recommendations.slice(0, 5),
        })),
        bloom: input.content.bloomDistribution,
        accuracyConcerns: input.content.accuracyConcerns.slice(0, 10),
        strengths: input.content.strengths.slice(0, 8),
      }
    : "stage failed or skipped";

  const result = await generateStructured({
    agent: "Report agent",
    effort: "medium",
    schema: ReportSchema,
    system: `You are the reporting agent in a curriculum review pipeline. You receive the structured results of the other agents and write the final report for the curriculum department.
- executiveSummary: one or two paragraphs for decision makers: overall quality, the most important problems, and what to do first. Refer to the computed scores as given; do not recompute or change them.
- keyFindings: 4-8 of the most significant findings, each one sentence.
- recommendations: prioritised, concrete actions. high = must fix before approval.
Use only the information in the agent results. If a stage failed, say that part was not assessed rather than guessing.
Write in the same language as the curriculum (curriculum language: ${input.profile?.language ?? "unknown"}).`,
    user: JSON.stringify(
      {
        curriculum: input.profile,
        scores,
        failedStages: input.failedStages,
        language: languageSummary,
        standards: alignmentSummary,
        content: contentSummary,
      },
      null,
      2,
    ),
  });

  return {
    executiveSummary: result.executiveSummary,
    keyFindings: result.keyFindings,
    recommendations: result.recommendations,
    overallScore: scores.overall,
    scores: { language: scores.language, standards: scores.standards, content: scores.content },
  };
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}
