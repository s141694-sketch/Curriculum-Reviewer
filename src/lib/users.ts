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

const FILE = path.join(process.cwd(), "data", "logins.json");

export async function readLogins(): Promise<LoginRecord[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as LoginRecord[];
  } catch {
    return [];
  }
}

export async function appendLogin(record: LoginRecord): Promise<void> {
  const all = await readLogins();
  all.unshift(record);
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(all.slice(0, 1000), null, 2));
}

export async function clearLogins(): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, "[]");
}
