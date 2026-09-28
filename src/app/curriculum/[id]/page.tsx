"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Curriculum, Module, Topic } from "@/types/curriculum";
import { getCurriculum, saveCurriculum } from "@/lib/storage";
import { Diamond } from "@/components/HarakLogo";

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
        <p className="text-muted">لم يُعثر على هذا المنهج.</p>
        <Link href="/" className="font-semibold text-navy underline hover:text-maroon">
          العودة إلى مناهجي
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <Link href="/" className="text-sm font-medium text-muted hover:text-maroon">
          → مناهجي
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{curriculum.level}</span>
          <span aria-hidden="true">·</span>
          <span>{curriculum.durationWeeks} أسبوعاً</span>
        </div>
        <input
          aria-label="اسم المنهج"
          value={curriculum.subject}
          onChange={(e) => update({ ...curriculum, subject: e.target.value })}
          className="rounded-lg bg-transparent font-display text-3xl leading-snug font-bold text-navy outline-none focus:bg-white md:text-4xl"
        />
        {curriculum.goals && <p className="max-w-3xl leading-8 text-muted">{curriculum.goals}</p>}
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {curriculum.modules.length > 0 && (
          <nav
            aria-label="الوحدات"
            className="relative flex flex-col gap-1 rounded-2xl border border-line bg-white p-4 lg:sticky lg:top-6 lg:w-72 lg:shrink-0"
          >
            <span
              className="absolute top-9 right-[29px] bottom-9 border-r-2 border-dashed border-gold"
              aria-hidden="true"
            />
            {curriculum.modules.map((module, index) => (
              <a
                key={module.id}
                href={`#${module.id}`}
                className="relative flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-sand"
              >
                <span className="size-3 shrink-0 rounded-full border-2 border-navy bg-white" aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="text-xs text-muted">الوحدة {index + 1}</span>
                  <span className="text-sm font-semibold text-navy">{module.title || "وحدة بلا عنوان"}</span>
                </span>
              </a>
            ))}
          </nav>
        )}

        <section className="flex flex-1 flex-col gap-6">
          {curriculum.modules.map((module, index) => (
            <div
              key={module.id}
              id={module.id}
              className="relative flex scroll-mt-6 flex-col gap-4 overflow-hidden rounded-2xl border border-line bg-white p-6"
            >
              <span className="absolute inset-x-0 top-0 h-1 bg-gold" aria-hidden="true" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gold-ink">الوحدة {index + 1}</span>
                <button
                  onClick={() => removeModule(module.id)}
                  className="rounded-lg px-2 py-1 text-sm text-maroon-soft hover:bg-sand"
                >
                  حذف الوحدة
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <label className="flex flex-col gap-1.5 text-sm font-semibold md:col-span-3">
                  عنوان الوحدة
                  <input
                    value={module.title}
                    onChange={(e) => updateModule(module.id, { title: e.target.value })}
                    placeholder="عنوان الوحدة"
                    className="harak-field font-display text-lg font-bold text-navy"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  الساعات
                  <input
                    type="number"
                    min={0}
                    value={module.durationHours}
                    onChange={(e) => updateModule(module.id, { durationHours: Number(e.target.value) })}
                    className="harak-field text-base font-normal"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                هدف الوحدة
                <textarea
                  value={module.objective}
                  onChange={(e) => updateModule(module.id, { objective: e.target.value })}
                  placeholder="هدف التعلّم"
                  rows={2}
                  className="harak-field resize-none text-base leading-8 font-normal"
                />
              </label>

              <div className="flex items-center gap-3">
                <Diamond size={10} className="text-gold" />
                <h3 className="font-display text-lg font-bold text-navy">الموضوعات</h3>
                <span className="h-px flex-1 bg-line" aria-hidden="true" />
              </div>

              <div className="flex flex-col gap-2.5">
                {module.topics.map((topic, topicIndex) => (
                  <div
                    key={topic.id}
                    className="flex items-start gap-3 rounded-xl border border-line p-3"
                  >
                    <span className="mt-1.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[#EDEEF6] text-sm font-semibold text-navy">
                      {topicIndex + 1}
                    </span>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <input
                        aria-label="عنوان الموضوع"
                        value={topic.title}
                        onChange={(e) => updateTopic(module.id, topic.id, { title: e.target.value })}
                        placeholder="عنوان الموضوع"
                        className="harak-field py-1.5 font-semibold"
                      />
                      <input
                        aria-label="وصف الموضوع"
                        value={topic.description}
                        onChange={(e) =>
                          updateTopic(module.id, topic.id, { description: e.target.value })
                        }
                        placeholder="وصف مختصر للموضوع"
                        className="harak-field py-1.5 text-sm text-muted"
                      />
                    </div>
                    <button
                      onClick={() => removeTopic(module.id, topic.id)}
                      className="mt-1.5 rounded-lg px-2 py-1 text-sm text-maroon-soft hover:bg-sand"
                    >
                      حذف
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addTopic(module.id)}
                  className="rounded-xl border-[1.5px] border-dashed border-gold bg-ivory py-3 text-sm font-semibold text-gold-ink hover:bg-sand"
                >
                  + إضافة موضوع
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addModule}
            className="self-start rounded-xl bg-sand px-5 py-3 text-sm font-semibold text-navy hover:bg-line"
          >
            + إضافة وحدة
          </button>
        </section>
      </div>
    </main>
  );
}
