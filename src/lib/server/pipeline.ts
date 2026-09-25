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
import type { Review, StageId, StageState } from "@/types/review";

// Orchestrator. Stage graph:
//
//   ingestion ──┬── language  ──┐
//               ├── standards ──┼── report
//               └── content   ──┘
//
// The three analysis agents run in parallel. A failing analysis stage does
// not stop the others; the report agent states which parts were not assessed.

export const STAGE_ORDER: StageId[] = ["ingestion", "language", "standards", "content", "report"];

export function initialStages(hasFramework: boolean): StageState[] {
  return STAGE_ORDER.map((id) => ({
    id,
    status: id === "standards" && !hasFramework ? "skipped" : "pending",
  }));
}

// Reviews currently executing in this process, so a double click cannot start two runs.
const running = new Set<string>();

export function isRunning(id: string): boolean {
  return running.has(id);
}

async function setStage(id: string, stage: StageId, patch: Partial<StageState>): Promise<void> {
  await updateReview(id, (review) => {
    const target = review.stages.find((s) => s.id === stage);
    if (target) Object.assign(target, patch);
  });
}

async function runStage<T>(
  reviewId: string,
  stage: StageId,
  work: (progress: (note: string) => Promise<void>) => Promise<T>,
): Promise<T | null> {
  await setStage(reviewId, stage, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
    progress: undefined,
  });
  try {
    const result = await work((note) => setStage(reviewId, stage, { progress: note }));
    await setStage(reviewId, stage, { status: "done", finishedAt: new Date().toISOString() });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[review ${reviewId}] stage ${stage} failed:`, error);
    await setStage(reviewId, stage, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: message,
    });
    return null;
  }
}

export async function runReviewPipeline(reviewId: string): Promise<void> {
  if (running.has(reviewId)) return;
  running.add(reviewId);

  try {
    const review = await getReview(reviewId);
    if (!review) return;

    await updateReview(reviewId, (r) => {
      r.status = "running";
      r.engine = engineLabel();
      for (const stage of r.stages) {
        if (stage.status !== "skipped") {
          stage.status = "pending";
          stage.error = undefined;
          stage.progress = undefined;
        }
      }
    });

    // 1. Ingestion: split into sections + profile. Without sections nothing else can run.
    const sections = splitIntoSections(review.sourceText);
    await updateReview(reviewId, (r) => {
      r.sections = sections;
    });
    const profile = await runStage(reviewId, "ingestion", () => ingestionAgent(sections));
    if (!sections.length) {
      await finish(reviewId, "failed");
      return;
    }
    await updateReview(reviewId, (r) => {
      r.profile = profile;
    });

    // 2-4. Analysis agents in parallel.
    const framework = review.frameworkId ? await getFramework(review.frameworkId) : null;

    const [languageIssues, alignment, content] = await Promise.all([
      runStage(reviewId, "language", (progress) => languageAgent(sections, progress)).then(
        async (issues) => {
          await updateReview(reviewId, (r) => {
            r.languageIssues = issues;
          });
          return issues;
        },
      ),
      framework && framework.standards.length
        ? runStage(reviewId, "standards", (progress) =>
            standardsAgent(sections, framework.standards, profile, progress),
          ).then(async (result) => {
            await updateReview(reviewId, (r) => {
              r.alignment = result;
            });
            return result;
          })
        : setStage(reviewId, "standards", { status: "skipped" }).then(() => null),
      runStage(reviewId, "content", (progress) => contentAgent(sections, profile, progress)).then(
        async (result) => {
          await updateReview(reviewId, (r) => {
            r.content = result;
          });
          return result;
        },
      ),
    ]);

    // 5. Report.
    const current = (await getReview(reviewId)) as Review;
    const failedStages = current.stages.filter((s) => s.status === "failed").map((s) => s.id);
    const wordCount = review.sourceText.split(/\s+/).filter(Boolean).length;

    const report = await runStage(reviewId, "report", () =>
      reportAgent({
        profile,
        frameworkName: framework?.name ?? null,
        wordCount,
        languageIssues,
        alignment,
        content,
        failedStages,
      }),
    );
    await updateReview(reviewId, (r) => {
      r.report = report;
    });

    await finish(reviewId, report ? "done" : "failed");
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
