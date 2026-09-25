import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import type { Review, ReviewSummary, StandardsFramework } from "@/types/review";

// Persistence with two interchangeable backends:
//
// - "fs": JSON files on the server's own disk (DATA_DIR). Default for the
//   internal-server / Docker deployment: nothing leaves the machine.
// - "blob": a PRIVATE Vercel Blob store. Used automatically when
//   BLOB_READ_WRITE_TOKEN is set (e.g. on Vercel, whose file system is
//   read-only and whose requests can hit different instances). Reads bypass
//   the CDN cache so progress updates are always current.

const ID_PATTERN = /^[a-zA-Z0-9-]+$/;

type Collection = "reviews" | "summaries" | "frameworks";

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "التخزين غير مهيأ: الموقع يعمل على Vercel ونظام الملفات هناك للقراءة فقط. اربط مخزن Vercel Blob (خاص) بالمشروع ليُضاف BLOB_READ_WRITE_TOKEN، ثم أعد النشر.",
    );
  }
}

export function storageBackend(): "fs" | "blob" {
  const explicit = process.env.STORAGE_BACKEND?.toLowerCase();
  if (explicit === "fs" || explicit === "blob") return explicit;
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "fs";
}

function checkId(id: string): string {
  if (!ID_PATTERN.test(id)) throw new Error("معرّف غير صالح");
  return id;
}

interface Backend {
  read<T>(collection: Collection, id: string): Promise<T | null>;
  write(collection: Collection, id: string, value: unknown): Promise<void>;
  remove(collection: Collection, id: string): Promise<void>;
  ids(collection: Collection): Promise<string[]>;
}

async function readAll<T>(collection: Collection): Promise<T[]> {
  const store = backend();
  const items = await Promise.all(
    (await store.ids(collection)).map((id) => store.read<T>(collection, id).catch(() => null)),
  );
  return items.filter((item): item is Awaited<T> => item !== null) as T[];
}

// ---- Local file system ----

const DATA_DIR = path.resolve(
  /*turbopackIgnore: true*/
  process.env.DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data"),
);

function fsPath(collection: Collection, id: string): string {
  return path.join(/*turbopackIgnore: true*/ DATA_DIR, collection, `${checkId(id)}.json`);
}

const fsBackend: Backend = {
  async read<T>(collection: Collection, id: string) {
    try {
      return JSON.parse(await fs.readFile(fsPath(collection, id), "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
  async write(collection, id, value) {
    // On Vercel the deployment directory is read-only: fail with instructions, not ENOENT/EROFS.
    if (process.env.VERCEL) throw new StorageNotConfiguredError();
    const file = fsPath(collection, id);
    await fs.mkdir(path.dirname(file), { recursive: true });
    // Write to a temp file then rename so readers never see a half-written file.
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
    await fs.rename(tmp, file);
  },
  async remove(collection, id) {
    await fs.rm(fsPath(collection, id), { force: true });
  },
  async ids(collection) {
    try {
      const names = await fs.readdir(path.join(/*turbopackIgnore: true*/ DATA_DIR, collection));
      return names.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  },
};

// ---- Vercel Blob (private) ----

const BLOB_PREFIX = "curriculum-reviewer";

function blobPath(collection: Collection, id: string): string {
  return `${BLOB_PREFIX}/${collection}/${checkId(id)}.json`;
}

const blobBackend: Backend = {
  async read<T>(collection: Collection, id: string) {
    const result = await get(blobPath(collection, id), { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return JSON.parse(await new Response(result.stream).text()) as T;
  },
  async write(collection, id, value) {
    await put(blobPath(collection, id), JSON.stringify(value), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  },
  async remove(collection, id) {
    await del(blobPath(collection, id));
  },
  async ids(collection) {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: `${BLOB_PREFIX}/${collection}/`, cursor, limit: 1000 });
      ids.push(...page.blobs.map((b) => b.pathname.split("/").pop()!.replace(/\.json$/, "")));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return ids;
  },
};

function backend(): Backend {
  return storageBackend() === "blob" ? blobBackend : fsBackend;
}

/** Quick read/write probe used by the health check. */
export async function checkStorage(): Promise<void> {
  const probe = { at: new Date().toISOString() };
  await backend().write("summaries", "health-probe", probe);
  await backend().remove("summaries", "health-probe");
}

// ---- Reviews ----

function toSummary(review: Review): ReviewSummary {
  return {
    id: review.id,
    title: review.title,
    fileName: review.fileName,
    frameworkName: review.frameworkName,
    status: review.status,
    stages: review.stages,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    overallScore: review.report?.overallScore ?? null,
  };
}

// Per-review write queue so concurrent stage updates never clobber each other.
const reviewLocks = new Map<string, Promise<unknown>>();

export async function getReview(id: string): Promise<Review | null> {
  if (!ID_PATTERN.test(id)) return null;
  return backend().read<Review>("reviews", id);
}

export async function saveReview(review: Review): Promise<void> {
  // The small summary file keeps the dashboard fast: it never loads full texts.
  await backend().write("reviews", review.id, review);
  await backend().write("summaries", review.id, toSummary(review));
}

/** Atomically (within this process) read-modify-write a review. */
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
  const summaries = await readAll<ReviewSummary>("summaries");
  // Reviews saved before summary files existed: create their summaries once.
  const known = new Set(summaries.map((s) => s.id));
  for (const id of await backend().ids("reviews")) {
    if (known.has(id)) continue;
    const review = await getReview(id).catch(() => null);
    if (!review) continue;
    const summary = toSummary(review);
    summaries.push(summary);
    await backend().write("summaries", id, summary).catch(() => undefined);
  }
  return summaries
    .filter((s) => s.id !== "health-probe")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteReview(id: string): Promise<void> {
  checkId(id);
  await backend().remove("reviews", id);
  await backend().remove("summaries", id);
}

// ---- Standards frameworks ----

export async function getFramework(id: string): Promise<StandardsFramework | null> {
  if (!ID_PATTERN.test(id)) return null;
  return backend().read<StandardsFramework>("frameworks", id);
}

export async function saveFramework(framework: StandardsFramework): Promise<void> {
  await backend().write("frameworks", framework.id, framework);
}

export async function listFrameworks(): Promise<StandardsFramework[]> {
  const frameworks = await readAll<StandardsFramework>("frameworks");
  return frameworks.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteFramework(id: string): Promise<void> {
  checkId(id);
  await backend().remove("frameworks", id);
}
