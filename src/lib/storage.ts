import type { Curriculum } from "@/types/curriculum";

const STORAGE_KEY = "curriculum-reviewer:curricula";

function readAll(): Curriculum[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Curriculum[];
  } catch {
    return [];
  }
}

function writeAll(curricula: Curriculum[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(curricula));
}

export function listCurricula(): Curriculum[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCurriculum(id: string): Curriculum | undefined {
  return readAll().find((c) => c.id === id);
}

export function saveCurriculum(curriculum: Curriculum): void {
  const all = readAll();
  const index = all.findIndex((c) => c.id === curriculum.id);
  if (index === -1) {
    all.push(curriculum);
  } else {
    all[index] = curriculum;
  }
  writeAll(all);
}

export function deleteCurriculum(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}
