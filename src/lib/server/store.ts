import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Review, ReviewSummary, StandardsFramework } from "@/types/review";

// File-based JSON store. Everything stays on the server's own disk (DATA_DIR),
// which keeps the deployment self-contained on an internal server with no
// external database. Swap this module for a real database if you need
// concurrent multi-instance access.

const DATA_DIR = path.resolve(
  /*turbopackIgnore: true*/
  process.env.DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data"),
);

const ID_PATTERN = /^[a-zA-Z0-9-]+$/;

function collectionDir(collection: "reviews" | "frameworks"): string {
  return path.join(/*turbopackIgnore: true*/ DATA_DIR, collection);
}

function filePath(collection: "reviews" | "frameworks", id: string): string {
  if (!ID_PATTERN.test(id)) {
    throw new Error("Invalid id");
  }
  return path.join(/*turbopackIgnore: true*/ collectionDir(collection), `${id}.json`);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  // Write to a temp file then rename so readers never see a half-written file.
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, file);
}

async function listJson<T>(collection: "reviews" | "frameworks"): Promise<T[]> {
  let names: string[];
  try {
    names = await fs.readdir(collectionDir(collection));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const items = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map((name) => readJson<T>(path.join(/*turbopackIgnore: true*/ collectionDir(collection), name))),
  );
  return items.filter((item): item is Awaited<T> => item !== null) as T[];
}

// ---- Reviews ----

// Per-review write queue so concurrent stage updates never clobber each other.
const reviewLocks = new Map<string, Promise<unknown>>();

export async function getReview(id: string): Promise<Review | null> {
  return readJson<Review>(filePath("reviews", id));
}

export async function saveReview(review: Review): Promise<void> {
  await writeJson(filePath("reviews", review.id), review);
}

/** Atomically read-modify-write a review. */
export async function updateReview(
  id: string,
  mutate: (review: Review) => void,
): Promise<Review> {
  const previous = reviewLocks.get(id) ?? Promise.resolve();
  const next = previous.then(async () => {
    const review = await getReview(id);
    if (!review) throw new Error(`Review ${id} not found`);
    mutate(review);
    review.updatedAt = new Date().toISOString();
    await saveReview(review);
    return review;
  });
  reviewLocks.set(
    id,
    next.catch(() => undefined),
  );
  return next;
}

export async function listReviews(): Promise<ReviewSummary[]> {
  const reviews = await listJson<Review>("reviews");
  return reviews
    .map((review) => ({
      id: review.id,
      title: review.title,
      fileName: review.fileName,
      frameworkName: review.frameworkName,
      status: review.status,
      stages: review.stages,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      overallScore: review.report?.overallScore ?? null,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteReview(id: string): Promise<void> {
  await fs.rm(filePath("reviews", id), { force: true });
}

// ---- Standards frameworks ----

export async function getFramework(id: string): Promise<StandardsFramework | null> {
  return readJson<StandardsFramework>(filePath("frameworks", id));
}

export async function saveFramework(framework: StandardsFramework): Promise<void> {
  await writeJson(filePath("frameworks", framework.id), framework);
}

export async function listFrameworks(): Promise<StandardsFramework[]> {
  const frameworks = await listJson<StandardsFramework>("frameworks");
  return frameworks.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteFramework(id: string): Promise<void> {
  await fs.rm(filePath("frameworks", id), { force: true });
}
