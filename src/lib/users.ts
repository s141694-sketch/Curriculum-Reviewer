import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Role } from "./session";

// Login log kept in a JSON file next to the app (data/logins.json). Good
// enough for a single Node server; swap for a database alongside storage.ts
// when the app moves to serverless or multi-instance hosting.

export interface LoginRecord {
  name: string;
  role: Role;
  at: string;
}

// On Vercel only /tmp is writable, so there the log is per-instance and
// temporary until it moves to a database (cr-q7m.2).
const DIR = process.env.VERCEL ? path.join("/tmp", "harak-data") : path.join(process.cwd(), "data");
const FILE = path.join(DIR, "logins.json");

export async function readLogins(): Promise<LoginRecord[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as LoginRecord[];
  } catch {
    return [];
  }
}

// A failed write must never block sign-in; it is logged and skipped.
export async function appendLogin(record: LoginRecord): Promise<void> {
  try {
    const all = await readLogins();
    all.unshift(record);
    await mkdir(DIR, { recursive: true });
    await writeFile(FILE, JSON.stringify(all.slice(0, 1000), null, 2));
  } catch (error) {
    console.error("Login log not saved:", error);
  }
}

export async function clearLogins(): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, "[]");
}
