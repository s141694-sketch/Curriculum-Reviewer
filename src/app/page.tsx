"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Curriculum } from "@/types/curriculum";
import { deleteCurriculum, listCurricula } from "@/lib/storage";

export default function HomePage() {
  const [curricula, setCurricula] = useState<Curriculum[]>([]);

  useEffect(() => {
    // localStorage is an external store only available client-side; this is
    // the initial read on mount, not a derived-state cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurricula(listCurricula());
  }, []);

  function handleDelete(id: string) {
    deleteCurriculum(id);
    setCurricula(listCurricula());
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Curriculum Reviewer</h1>
          <p className="text-sm text-neutral-500">
            AI-assisted curriculum design and review.
          </p>
        </div>
        <Link
          href="/curriculum/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          New curriculum
        </Link>
      </header>

      {curricula.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No curricula yet. Create one to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {curricula.map((curriculum) => (
            <li
              key={curriculum.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <Link href={`/curriculum/${curriculum.id}`} className="flex-1">
                <p className="font-medium">{curriculum.subject}</p>
                <p className="text-sm text-neutral-500">
                  {curriculum.level} &middot; {curriculum.durationWeeks} weeks &middot;{" "}
                  {curriculum.modules.length} modules
                </p>
              </Link>
              <button
                onClick={() => handleDelete(curriculum.id)}
                className="text-sm text-neutral-400 hover:text-red-500"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
