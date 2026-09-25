"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Curriculum, Module } from "@/types/curriculum";
import { saveCurriculum } from "@/lib/storage";

export default function NewCurriculumPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("Undergraduate");
  const [goals, setGoals] = useState("");
  const [durationWeeks, setDurationWeeks] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, level, goals, durationWeeks }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate curriculum");
      }

      const now = new Date().toISOString();
      const curriculum: Curriculum = {
        id: crypto.randomUUID(),
        subject,
        level,
        goals,
        durationWeeks,
        modules: (data.modules as Omit<Module, "id">[]).map((module) => ({
          ...module,
          id: crypto.randomUUID(),
        })),
        createdAt: now,
        updatedAt: now,
      };

      saveCurriculum(curriculum);
      router.push(`/curriculum/${curriculum.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    const now = new Date().toISOString();
    const curriculum: Curriculum = {
      id: crypto.randomUUID(),
      subject: subject || "Untitled curriculum",
      level,
      goals,
      durationWeeks,
      modules: [],
      createdAt: now,
      updatedAt: now,
    };
    saveCurriculum(curriculum);
    router.push(`/curriculum/${curriculum.id}`);
  }

  return (
    <main dir="ltr" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">New curriculum</h1>
      <form onSubmit={handleGenerate} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Subject
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Introduction to Data Structures"
            className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Level
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option>High School</option>
            <option>Undergraduate</option>
            <option>Graduate</option>
            <option>Professional</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Learning goals
          <textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="What should learners be able to do by the end?"
            rows={3}
            className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Duration (weeks)
          <input
            type="number"
            min={1}
            max={52}
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(Number(e.target.value))}
            className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {loading ? "Generating..." : "Generate with AI"}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Start blank
          </button>
        </div>
      </form>
    </main>
  );
}
