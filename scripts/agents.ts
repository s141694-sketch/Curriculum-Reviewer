/*
 * Command-line runner for the curriculum review agents - no web server needed.
 *
 *   npm run agents -- review <file|folder>... [--framework standards.txt] [--out results]
 *                          [--stages language,content] [--title "..."]
 *   npm run agents -- seed <clean.txt|.docx|.pdf> [--out eval] [--per1k 8] [--seed 42]
 *   npm run agents -- eval-language <manifest.json> [--runs 3] [--out eval]
 *   npm run agents -- eval-standards <review.json> <gold.json>
 *
 * Settings come from .env.local / .env (LLM_PROVIDER, OLLAMA_URL, ...), same as the web app.
 */

import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { scoreAlignment, scoreLanguage, type LanguageMetrics } from "@/lib/eval/metrics";
import { seedErrors, type SeededError } from "@/lib/eval/seed";
import { reviewToMarkdown } from "@/lib/report-markdown";
import { languageAgent } from "@/lib/server/agents";
import { extractText, SUPPORTED_EXTENSIONS, splitIntoSections } from "@/lib/server/extract";
import { engineLabel } from "@/lib/server/llm";
import { executeReview, type ReviewResult, STAGE_ORDER } from "@/lib/server/pipeline";
import { parseStandards } from "@/lib/standards";
import type { AlignmentStatus, LanguageIssue, Review, StageId, Standard } from "@/types/review";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const USAGE = `Usage:
  npm run agents -- review <file|folder>... [--framework <file>] [--out <dir>] [--stages <list>] [--title <text>]
  npm run agents -- seed <file> [--out <dir>] [--per1k <n>] [--seed <n>]
  npm run agents -- eval-language <manifest.json> [--runs <n>] [--out <dir>]
  npm run agents -- eval-standards <review.json> <gold.json>

Stages: ${STAGE_ORDER.join(", ")}
Framework file: one standard per line "CODE | description", or a JSON export from the web app.`;

function log(message: string) {
  const time = new Date().toTimeString().slice(0, 8);
  console.log(`[${time}] ${message}`);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function readDocument(file: string): Promise<string> {
  const data = await fs.readFile(file);
  return extractText(path.basename(file), new Uint8Array(data).buffer);
}

async function loadFramework(file: string): Promise<{ name: string; standards: Standard[] }> {
  const raw = await fs.readFile(file, "utf8");
  if (file.endsWith(".json")) {
    const parsed = JSON.parse(raw);
    const framework = parsed.framework ?? parsed;
    return { name: framework.name ?? path.basename(file), standards: framework.standards };
  }
  return { name: path.basename(file, path.extname(file)), standards: parseStandards(raw) };
}

/** Expand folders into the supported documents they contain (non-recursive). */
async function expandInputs(inputs: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const input of inputs) {
    const stat = await fs.stat(input);
    if (stat.isDirectory()) {
      for (const name of (await fs.readdir(input)).sort()) {
        if (SUPPORTED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))) {
          files.push(path.join(input, name));
        }
      }
    } else {
      files.push(input);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// review

async function commandReview(positionals: string[], values: Record<string, string | undefined>) {
  if (!positionals.length) throw new Error("review: give at least one file or folder");
  const files = await expandInputs(positionals);
  if (!files.length) throw new Error(`No supported files found (${SUPPORTED_EXTENSIONS.join(", ")})`);

  const framework = values.framework ? await loadFramework(values.framework) : null;
  const stages = values.stages
    ? (values.stages.split(",").map((s) => s.trim()) as StageId[])
    : undefined;
  for (const stage of stages ?? []) {
    if (!STAGE_ORDER.includes(stage)) throw new Error(`Unknown stage "${stage}"`);
  }
  const outRoot = values.out ?? "results";

  log(`engine ${engineLabel()} | ${files.length} file(s) | framework: ${framework?.name ?? "none"}`);
  const summary: string[][] = [
    ["file", "status", "overall", "language", "standards", "content", "issues", "words", "seconds"],
  ];

  for (const file of files) {
    // Keep the extension so sample.docx and sample.pdf do not overwrite each other.
    const base = path.basename(file).replace(/\./g, "_");
    const outDir = path.join(outRoot, base);
    await fs.mkdir(outDir, { recursive: true });
    const tracePath = path.join(outDir, "trace.jsonl");
    await fs.writeFile(tracePath, "");

    log(`▶ ${file}`);
    const started = Date.now();
    let sourceText: string;
    try {
      sourceText = await readDocument(file);
    } catch (error) {
      log(`  ✗ could not read: ${error instanceof Error ? error.message : error}`);
      summary.push([file, "unreadable", "", "", "", "", "", "", ""]);
      continue;
    }

    const result: ReviewResult = await executeReview(
      {
        sourceText,
        frameworkName: framework?.name ?? null,
        standards: framework?.standards ?? [],
        stages,
      },
      {
        onStage: async (stage) => {
          await fs.appendFile(tracePath, JSON.stringify({ at: new Date().toISOString(), ...stage }) + "\n");
          const detail = stage.error ? ` - ${stage.error}` : stage.progress ? ` (${stage.progress})` : "";
          log(`  ${stage.id.padEnd(10)} ${stage.status}${detail}`);
        },
      },
    );
    const seconds = (Date.now() - started) / 1000;

    const now = new Date().toISOString();
    const review: Review = {
      id: base,
      title: values.title ?? base,
      fileName: path.basename(file),
      frameworkId: null,
      frameworkName: framework?.name ?? null,
      // Failed only if a stage that was asked for failed (skipped stages are fine).
      status: result.stages.some((s) => s.status === "failed") ? "failed" : "done",
      stages: result.stages,
      createdAt: now,
      updatedAt: now,
      engine: result.engine,
      sourceText,
      sections: result.sections,
      profile: result.profile,
      languageIssues: result.languageIssues,
      alignment: result.alignment,
      content: result.content,
      report: result.report,
    };

    await fs.writeFile(
      path.join(outDir, "review.json"),
      JSON.stringify({ ...review, timings: result.timings }, null, 2),
    );
    await fs.writeFile(path.join(outDir, "report.md"), reviewToMarkdown(review));

    const r = result.report;
    summary.push([
      file,
      review.status,
      String(r?.overallScore ?? ""),
      String(r?.scores.language ?? ""),
      String(r?.scores.standards ?? ""),
      String(r?.scores.content ?? ""),
      String(result.languageIssues?.length ?? ""),
      String(sourceText.split(/\s+/).filter(Boolean).length),
      seconds.toFixed(1),
    ]);
    log(`  ${review.status === "done" ? "✓" : "✗"} ${review.status} in ${seconds.toFixed(1)}s → ${outDir}`);
  }

  await fs.mkdir(outRoot, { recursive: true });
  await fs.writeFile(
    path.join(outRoot, "summary.csv"),
    summary.map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n") + "\n",
  );
  console.table(summary.slice(1).map((row) => Object.fromEntries(summary[0].map((h, i) => [h, row[i]]))));
  log(`summary → ${path.join(outRoot, "summary.csv")}`);
}

// ---------------------------------------------------------------------------
// seed

interface SeedManifest {
  source: string;
  cleanFile: string;
  seededFile: string;
  seed: number;
  per1k: number;
  wordCount: number;
  errors: SeededError[];
}

async function commandSeed(positionals: string[], values: Record<string, string | undefined>) {
  const [input] = positionals;
  if (!input) throw new Error("seed: give a clean source document");
  const outDir = values.out ?? "eval";
  const seed = Number(values.seed ?? 42);
  const per1k = Number(values.per1k ?? 8);

  const clean = await readDocument(input);
  const result = seedErrors(clean, { seed, per1k });
  const base = path.basename(input, path.extname(input));
  await fs.mkdir(outDir, { recursive: true });

  const manifest: SeedManifest = {
    source: input,
    cleanFile: `${base}.clean.txt`,
    seededFile: `${base}.seeded.txt`,
    seed,
    per1k,
    wordCount: result.wordCount,
    errors: result.errors,
  };
  await fs.writeFile(path.join(outDir, manifest.cleanFile), clean);
  await fs.writeFile(path.join(outDir, manifest.seededFile), result.text);
  await fs.writeFile(path.join(outDir, `${base}.manifest.json`), JSON.stringify(manifest, null, 2));

  const byType: Record<string, number> = {};
  for (const e of result.errors) byType[e.type] = (byType[e.type] ?? 0) + 1;
  log(`planted ${result.errors.length} errors in ${result.wordCount} words (${JSON.stringify(byType)})`);
  log(`→ ${path.join(outDir, `${base}.manifest.json`)}`);
}

// ---------------------------------------------------------------------------
// eval-language

async function commandEvalLanguage(positionals: string[], values: Record<string, string | undefined>) {
  const [manifestPath] = positionals;
  if (!manifestPath) throw new Error("eval-language: give a manifest.json from the seed command");
  const runs = Math.max(1, Number(values.runs ?? 1));
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as SeedManifest;
  const dir = path.dirname(manifestPath);
  const clean = await fs.readFile(path.join(dir, manifest.cleanFile), "utf8");
  const seeded = await fs.readFile(path.join(dir, manifest.seededFile), "utf8");
  const noop = async () => {};

  log(`engine ${engineLabel()} | ${manifest.errors.length} planted errors | ${runs} run(s)`);
  if (manifest.errors.length < 30) {
    log(`  note: only ${manifest.errors.length} planted errors - use a longer text or --per1k for stable numbers`);
  }

  // The clean text is proofread once: whatever the agent flags there is either a real
  // pre-existing error or a false alarm, and is excluded when scoring the seeded run.
  log("proofreading clean text (baseline)...");
  const cleanIssues: LanguageIssue[] = await languageAgent(splitIntoSections(clean), noop);
  log(`  baseline flagged ${cleanIssues.length} issue(s) in the clean text`);

  const unreliable = scoreLanguage(manifest.errors, [], cleanIssues).unreliable;
  if (unreliable.length) {
    log(`  ${unreliable.length} planted error(s) excluded: their source word was already flagged in the clean text`);
  }

  const results: (LanguageMetrics & { seconds: number })[] = [];
  for (let run = 1; run <= runs; run++) {
    log(`run ${run}/${runs}: proofreading seeded text...`);
    const started = Date.now();
    const issues = await languageAgent(splitIntoSections(seeded), noop);
    const metrics = { ...scoreLanguage(manifest.errors, issues, cleanIssues), seconds: (Date.now() - started) / 1000 };
    results.push(metrics);
    log(
      `  precision ${pct(metrics.precision)} | recall ${pct(metrics.recall)} | F1 ${pct(metrics.f1)} | correction ${pct(metrics.correctionAccuracy)} | ${metrics.seconds.toFixed(1)}s`,
    );
  }

  const mean = (key: "precision" | "recall" | "f1" | "correctionAccuracy" | "seconds") =>
    results.reduce((s, r) => s + r[key], 0) / results.length;
  const sd = (key: "precision" | "recall" | "f1") => {
    const m = mean(key);
    return Math.sqrt(results.reduce((s, r) => s + (r[key] - m) ** 2, 0) / results.length);
  };

  const outDir = values.out ?? dir;
  const base = path.basename(manifestPath, ".manifest.json");
  const outFile = path.join(outDir, `${base}.language-eval.json`);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    outFile,
    JSON.stringify(
      {
        engine: engineLabel(),
        at: new Date().toISOString(),
        manifest: manifestPath,
        runs: results.length,
        mean: {
          precision: mean("precision"),
          recall: mean("recall"),
          f1: mean("f1"),
          correctionAccuracy: mean("correctionAccuracy"),
          seconds: mean("seconds"),
        },
        stdev: { precision: sd("precision"), recall: sd("recall"), f1: sd("f1") },
        baselineIssues: cleanIssues,
        results,
      },
      null,
      2,
    ),
  );

  const last = results[results.length - 1];
  console.table(
    Object.fromEntries(
      Object.entries(last.recallByType).map(([type, v]) => [type, { planted: v!.planted, detected: v!.detected, recall: pct(v!.recall) }]),
    ),
  );
  log(
    `MEAN over ${runs}: precision ${pct(mean("precision"))} ±${pct(sd("precision"))} | recall ${pct(mean("recall"))} ±${pct(sd("recall"))} | F1 ${pct(mean("f1"))}`,
  );
  log(`→ ${outFile}`);
}

// ---------------------------------------------------------------------------
// eval-standards

async function commandEvalStandards(positionals: string[]) {
  const [reviewPath, goldPath] = positionals;
  if (!reviewPath || !goldPath) throw new Error("eval-standards: give <review.json> <gold.json>");
  const review = JSON.parse(await fs.readFile(reviewPath, "utf8")) as Review;
  const gold = JSON.parse(await fs.readFile(goldPath, "utf8")) as Record<string, AlignmentStatus>;
  if (!review.alignment) throw new Error("This review has no standards alignment (was a framework given?)");

  for (const [code, status] of Object.entries(gold)) {
    if (!["met", "partial", "not_met"].includes(status)) {
      throw new Error(`gold "${code}": status must be met, partial or not_met`);
    }
  }

  const m = scoreAlignment(review.alignment, gold);
  log(`compared ${m.compared} standard(s)${m.missingCodes.length ? `, missing in review: ${m.missingCodes.join(", ")}` : ""}`);
  log(`accuracy ${pct(m.accuracy)} | Cohen's kappa ${m.kappa.toFixed(3)} | weighted kappa ${m.weightedKappa.toFixed(3)}`);
  console.log("confusion matrix (rows = gold, columns = agent):");
  console.table(m.confusion);
  if (m.disagreements.length) console.table(m.disagreements);

  const outFile = reviewPath.replace(/\.json$/, "") + ".standards-eval.json";
  await fs.writeFile(outFile, JSON.stringify({ at: new Date().toISOString(), gold: goldPath, ...m }, null, 2));
  log(`→ ${outFile}`);
}

// ---------------------------------------------------------------------------

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      framework: { type: "string" },
      out: { type: "string" },
      stages: { type: "string" },
      title: { type: "string" },
      per1k: { type: "string" },
      seed: { type: "string" },
      runs: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, ...rest] = positionals;
  const opts = values as Record<string, string | undefined>;

  switch (values.help ? undefined : command) {
    case "review":
      return commandReview(rest, opts);
    case "seed":
      return commandSeed(rest, opts);
    case "eval-language":
      return commandEvalLanguage(rest, opts);
    case "eval-standards":
      return commandEvalStandards(rest);
    default:
      console.log(USAGE);
      process.exitCode = command && !values.help ? 1 : 0;
  }
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
