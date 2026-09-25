import "server-only";
import {
  contentAgent,
  ingestionAgent,
  languageAgent,
  reportAgent,
  standardsAgent,
} from "@/lib/server/agents";
import { splitIntoSections } from "@/lib/server/extract";
import { engineLabel } from "@/lib/server/llm";
import { getFramework, getReview, updateReview } from "@/lib/server/store";
import type {
  ContentAnalysis,
  CurriculumProfile,
  DocumentSection,
  FinalReport,
  LanguageIssue,
  Review,
  StageId,
  StageState,
  Standard,
  StandardAlignment,
} from "@/types/review";

// Orchestrator. Stage graph:
//
//   ingestion ──┬── language  ──┐
//               ├── standards ──┼── report
//               └── content   ──┘
//
// The three analysis agents run in parallel. A failing analysis stage does
// not stop the others; the report agent states which parts were not assessed.
//
// `executeReview` is storage-agnostic so the same pipeline runs from the web
// app (runReviewPipeline, which persists to the store) and from the CLI.

export const STAGE_ORDER: StageId[] = ["ingestion", "language", "standards", "content", "report"];

export function initialStages(hasFramework: boolean): StageState[] {
  return STAGE_ORDER.map((id) => ({
    id,
    status: id === "standards" && !hasFramework ? "skipped" : "pending",
  }));
}

export interface ReviewInput {
  sourceText: string;
  frameworkName: string | null;
  standards: Standard[];
  /** Run only these stages (ingestion always runs). Defaults to all. */
  stages?: StageId[];
  /** Results of an earlier, interrupted run: stages already done are reused, not re-run. */
  previous?: Pick<Review, "stages" | "profile" | "languageIssues" | "alignment" | "content">;
}

export interface ReviewResult {
  sections: DocumentSection[];
  profile: CurriculumProfile | null;
  languageIssues: LanguageIssue[] | null;
  alignment: StandardAlignment[] | null;
  content: ContentAnalysis | null;
  report: FinalReport | null;
  stages: StageState[];
  /** Wall-clock milliseconds per stage. */
  timings: Partial<Record<StageId, number>>;
  engine: string;
}

export interface PipelineHooks {
  onStage?: (stage: StageState) => Promise<void> | void;
  onResult?: <K extends keyof ReviewResult>(key: K, value: ReviewResult[K]) => Promise<void> | void;
}

export async function executeReview(
  input: ReviewInput,
  hooks: PipelineHooks = {},
): Promise<ReviewResult> {
  const wanted = new Set<StageId>(input.stages ?? STAGE_ORDER);
  wanted.add("ingestion");
  const hasStandards = input.standards.length > 0;

  const stages = STAGE_ORDER.map(
    (id): StageState => ({
      id,
      status: !wanted.has(id) || (id === "standards" && !hasStandards) ? "skipped" : "pending",
    }),
  );
  const timings: ReviewResult["timings"] = {};

  async function update(id: StageId, patch: Partial<StageState>) {
    const stage = stages.find((s) => s.id === id)!;
    Object.assign(stage, patch);
    await hooks.onStage?.({ ...stage });
  }

  async function runStage<T>(
    id: StageId,
    work: (progress: (note: string) => Promise<void>) => Promise<T>,
    reuse?: T | null,
  ): Promise<T | null> {
    const stage = stages.find((s) => s.id === id)!;
    if (stage.status === "skipped") {
      await hooks.onStage?.({ ...stage });
      return null;
    }
    // Resume: keep a stage that finished in an earlier, interrupted run.
    const earlier = input.previous?.stages.find((s) => s.id === id);
    if (reuse != null && earlier?.status === "done") {
      await update(id, { ...earlier });
      return reuse;
    }
    const started = Date.now();
    await update(id, { status: "running", startedAt: new Date().toISOString() });
    try {
      const result = await work((note) => update(id, { progress: note }));
      timings[id] = Date.now() - started;
      await update(id, { status: "done", finishedAt: new Date().toISOString() });
      return result;
    } catch (error) {
      timings[id] = Date.now() - started;
      // Log the full error (with status codes / causes) so it shows up in server logs.
      console.error(`[pipeline] stage "${id}" failed:`, error);
      await update(id, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // 1. Ingestion: split into sections + profile.
  const sections = splitIntoSections(input.sourceText);
  await hooks.onResult?.("sections", sections);
  const previous = input.previous;
  const profile = await runStage("ingestion", () => ingestionAgent(sections), previous?.profile);
  await hooks.onResult?.("profile", profile);

  // 2-4. Analysis agents in parallel.
  const [languageIssues, alignment, content] = await Promise.all([
    runStage("language", (p) => languageAgent(sections, p), previous?.languageIssues).then(async (value) => {
      await hooks.onResult?.("languageIssues", value);
      return value;
    }),
    runStage(
      "standards",
      (p) => standardsAgent(sections, input.standards, profile, p),
      previous?.alignment,
    ).then(
      async (value) => {
        await hooks.onResult?.("alignment", value);
        return value;
      },
    ),
    runStage("content", (p) => contentAgent(sections, profile, p), previous?.content).then(async (value) => {
      await hooks.onResult?.("content", value);
      return value;
    }),
  ]);

  // 5. Report.
  const failedStages = stages.filter((s) => s.status === "failed").map((s) => s.id);
  const report = await runStage("report", () =>
    reportAgent({
      profile,
      frameworkName: input.frameworkName,
      wordCount: input.sourceText.split(/\s+/).filter(Boolean).length,
      languageIssues,
      alignment,
      content,
      failedStages,
    }),
  );
  await hooks.onResult?.("report", report);

  return {
    sections,
    profile,
    languageIssues,
    alignment,
    content,
    report,
    stages,
    timings,
    engine: engineLabel(),
  };
}

// ---- Web app wrapper: persists progress to the store. ----

// Reviews currently executing in this process, so a double click cannot start two runs.
const running = new Set<string>();

export function isRunning(id: string): boolean {
  return running.has(id);
}

// On Vercel a review can run on a different instance than the one answering,
// so "is it still running?" is judged by how recently it was updated. A
// function is stopped after maxDuration (300 s), so older means interrupted.
const STALE_AFTER_MS = 6 * 60 * 1000;

/** Is this review being worked on right now (by this or another instance)? */
export function isActive(review: Pick<Review, "id" | "status" | "updatedAt">): boolean {
  if (running.has(review.id)) return true;
  if (review.status !== "running" && review.status !== "queued") return false;
  // A single self-hosted process knows exactly what it runs; only serverless needs the heuristic.
  if (!process.env.VERCEL) return false;
  return Date.now() - new Date(review.updatedAt).getTime() < STALE_AFTER_MS;
}

/**
 * Run the agents for a stored review. With `resume`, stages that already
 * finished in an interrupted run are kept (useful after a timeout).
 */
export async function runReviewPipeline(reviewId: string, options: { resume?: boolean } = {}): Promise<void> {
  if (running.has(reviewId)) return;
  running.add(reviewId);

  try {
    const review = await getReview(reviewId);
    if (!review) return;

    const previous = options.resume
      ? {
          stages: review.stages,
          profile: review.profile,
          languageIssues: review.languageIssues,
          alignment: review.alignment,
          content: review.content,
        }
      : undefined;

    await updateReview(reviewId, (r) => {
      r.status = "running";
      r.engine = engineLabel();
      r.stages = initialStages(Boolean(r.frameworkId));
      if (!options.resume) {
        r.profile = r.languageIssues = r.alignment = r.content = r.report = null;
      }
    });

    const framework = review.frameworkId ? await getFramework(review.frameworkId) : null;

    const result = await executeReview(
      {
        sourceText: review.sourceText,
        frameworkName: framework?.name ?? null,
        standards: framework?.standards ?? [],
        previous,
      },
      {
        onStage: (stage) =>
          updateReview(reviewId, (r) => {
            const target = r.stages.find((s) => s.id === stage.id);
            if (target) Object.assign(target, stage);
          }).then(() => undefined),
        onResult: (key, value) =>
          updateReview(reviewId, (r) => {
            if (key in r) (r as unknown as Record<string, unknown>)[key] = value;
          }).then(() => undefined),
      },
    );

    await finish(reviewId, result.report ? "done" : "failed");
  } catch (error) {
    console.error(`[review ${reviewId}] pipeline crashed:`, error);
    await finish(reviewId, "failed").catch(() => undefined);
  } finally {
    running.delete(reviewId);
  }
}

async function finish(reviewId: string, status: Review["status"]): Promise<void> {
  await updateReview(reviewId, (r) => {
    r.status = status;
  });
}
