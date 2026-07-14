"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Curriculum, Module, Topic } from "@/types/curriculum";
import { getCurriculum, saveCurriculum } from "@/lib/storage";

function emptyModule(): Module {
  return {
    id: crypto.randomUUID(),
    title: "",
    objective: "",
    durationHours: 0,
    topics: [],
  };
}

function emptyTopic(): Topic {
  return { id: crypto.randomUUID(), title: "", description: "" };
}

export default function CurriculumEditorPage() {
  const params = useParams<{ id: string }>();
  const [curriculum, setCurriculum] = useState<Curriculum | null | undefined>(undefined);

  useEffect(() => {
    // localStorage is an external store only available client-side; this is
    // the initial read on mount, not a derived-state cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurriculum(getCurriculum(params.id));
  }, [params.id]);

  function update(next: Curriculum) {
    const updated = { ...next, updatedAt: new Date().toISOString() };
    setCurriculum(updated);
    saveCurriculum(updated);
  }

  function updateModule(moduleId: string, patch: Partial<Module>) {
    if (!curriculum) return;
    update({
      ...curriculum,
      modules: curriculum.modules.map((m) => (m.id === moduleId ? { ...m, ...patch } : m)),
    });
  }

  function updateTopic(moduleId: string, topicId: string, patch: Partial<Topic>) {
    if (!curriculum) return;
    update({
      ...curriculum,
      modules: curriculum.modules.map((m) =>
        m.id === moduleId
          ? { ...m, topics: m.topics.map((t) => (t.id === topicId ? { ...t, ...patch } : t)) }
          : m,
      ),
    });
  }

  function addModule() {
    if (!curriculum) return;
    update({ ...curriculum, modules: [...curriculum.modules, emptyModule()] });
  }

  function removeModule(moduleId: string) {
    if (!curriculum) return;
    update({ ...curriculum, modules: curriculum.modules.filter((m) => m.id !== moduleId) });
  }

  function addTopic(moduleId: string) {
    if (!curriculum) return;
    update({
      ...curriculum,
      modules: curriculum.modules.map((m) =>
        m.id === moduleId ? { ...m, topics: [...m.topics, emptyTopic()] } : m,
      ),
    });
  }

  function removeTopic(moduleId: string, topicId: string) {
    if (!curriculum) return;
    update({
      ...curriculum,
      modules: curriculum.modules.map((m) =>
        m.id === moduleId ? { ...m, topics: m.topics.filter((t) => t.id !== topicId) } : m,
      ),
    });
  }

  if (curriculum === undefined) {
    return null;
  }

  if (curriculum === null) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <p className="text-neutral-500">Curriculum not found.</p>
        <Link href="/" className="text-sm underline">
          Back to curricula
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          &larr; Back
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <input
          value={curriculum.subject}
          onChange={(e) => update({ ...curriculum, subject: e.target.value })}
          className="text-2xl font-semibold outline-none"
        />
        <div className="flex gap-4 text-sm text-neutral-500">
          <span>{curriculum.level}</span>
          <span>&middot;</span>
          <span>{curriculum.durationWeeks} weeks</span>
        </div>
        {curriculum.goals && <p className="text-sm text-neutral-600 dark:text-neutral-400">{curriculum.goals}</p>}
      </header>

      <section className="flex flex-col gap-6">
        {curriculum.modules.map((module, index) => (
          <div
            key={module.id}
            className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-neutral-400">Module {index + 1}</span>
              <button
                onClick={() => removeModule(module.id)}
                className="text-sm text-neutral-400 hover:text-red-500"
              >
                Remove module
              </button>
            </div>

            <input
              value={module.title}
              onChange={(e) => updateModule(module.id, { title: e.target.value })}
              placeholder="Module title"
              className="rounded-md border border-neutral-300 px-3 py-2 font-medium dark:border-neutral-700 dark:bg-neutral-900"
            />
            <textarea
              value={module.objective}
              onChange={(e) => updateModule(module.id, { objective: e.target.value })}
              placeholder="Learning objective"
              rows={2}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
            <label className="flex items-center gap-2 text-sm text-neutral-500">
              Hours
              <input
                type="number"
                min={0}
                value={module.durationHours}
                onChange={(e) => updateModule(module.id, { durationHours: Number(e.target.value) })}
                className="w-20 rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>

            <div className="flex flex-col gap-2 pl-4">
              {module.topics.map((topic) => (
                <div key={topic.id} className="flex items-start gap-2">
                  <div className="flex flex-1 flex-col gap-1">
                    <input
                      value={topic.title}
                      onChange={(e) => updateTopic(module.id, topic.id, { title: e.target.value })}
                      placeholder="Topic title"
                      className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                    />
                    <input
                      value={topic.description}
                      onChange={(e) =>
                        updateTopic(module.id, topic.id, { description: e.target.value })
                      }
                      placeholder="Topic description"
                      className="rounded-md border border-neutral-300 px-2 py-1 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
                    />
                  </div>
                  <button
                    onClick={() => removeTopic(module.id, topic.id)}
                    className="mt-1 text-xs text-neutral-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => addTopic(module.id)}
                className="self-start text-sm text-neutral-500 hover:underline"
              >
                + Add topic
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addModule}
          className="self-start rounded-md border border-dashed border-neutral-300 px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          + Add module
        </button>
      </section>
    </main>
  );
}
