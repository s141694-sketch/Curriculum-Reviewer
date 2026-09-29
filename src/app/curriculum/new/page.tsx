"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Curriculum, Module } from "@/types/curriculum";
import { saveCurriculum } from "@/lib/storage";
import { CompassMark } from "@/components/HarakLogo";

const levels = ["المرحلة الثانوية", "البكالوريوس", "الدراسات العليا", "التدريب المهني"];

const steps = [
  { title: "صِف المنهج", body: "المادة والمستوى والأهداف والمدة." },
  { title: "احصل على مسودة", body: "وحدات بأهدافها وساعاتها وموضوعاتها." },
  { title: "عدّل بحرّية", body: "غيّر أي وحدة أو موضوع مباشرة." },
];

export default function NewCurriculumPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState(levels[1]);
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
        throw new Error(data.error || "تعذّر إنشاء المسودة");
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
      setError(err instanceof Error ? err.message : "حدث خطأ ما");
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    const now = new Date().toISOString();
    const curriculum: Curriculum = {
      id: crypto.randomUUID(),
      subject: subject || "منهج بلا عنوان",
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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 lg:flex-row">
      <form
        onSubmit={handleGenerate}
        className="flex flex-1 flex-col gap-5 rounded-3xl border border-line bg-white p-8 md:p-10"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-gold-ink">منهج جديد</span>
          <h1 className="font-display text-3xl leading-snug font-bold text-navy md:text-4xl">
            حدّد وجهة المنهج
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            المادة
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثال: الملاحة البحرية"
              className="harak-field text-base font-normal"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            المستوى
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="harak-field text-base font-normal"
            >
              {levels.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          أهداف التعلّم
          <textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="ماذا يجب أن يستطيع الطالب فعله في نهاية المنهج؟"
            rows={4}
            className="harak-field resize-none text-base leading-8 font-normal"
          />
        </label>

        <label className="flex w-full max-w-60 flex-col gap-1.5 text-sm font-semibold">
          المدة بالأسابيع
          <input
            type="number"
            min={1}
            max={52}
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(Number(e.target.value))}
            className="harak-field text-base font-normal"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-[#F7E9E9] px-4 py-3 text-sm text-maroon">
            {error}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="harak-press flex items-center gap-2 rounded-xl bg-maroon px-6 py-3.5 font-semibold text-white hover:bg-maroon-soft disabled:opacity-70"
          >
            {loading ? (
              <>
                <CompassMark size={20} spinning className="text-gold-soft" />
                جارٍ إعداد المسودة…
              </>
            ) : (
              "إنشاء مسودة بالذكاء الاصطناعي"
            )}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="harak-press rounded-xl border-[1.5px] border-navy px-6 py-3.5 font-semibold text-navy hover:bg-sand"
          >
            البدء من صفحة فارغة
          </button>
        </div>
      </form>

      <aside className="relative flex flex-col gap-7 overflow-hidden rounded-3xl bg-navy p-8 text-ivory lg:w-96">
        <svg
          viewBox="-150 -150 300 300"
          className="harak-rose pointer-events-none absolute -bottom-28 -left-28 size-80 opacity-25"
          aria-hidden="true"
        >
          <circle r="140" fill="none" stroke="#D4AD6A" strokeWidth="1.5" />
          <circle r="110" fill="none" stroke="#D4AD6A" strokeDasharray="2 8" />
          <line x1="0" y1="-150" x2="0" y2="150" stroke="#D4AD6A" />
          <line x1="-150" y1="0" x2="150" y2="0" stroke="#D4AD6A" />
        </svg>
        <h2 className="font-display text-2xl font-bold text-[#F3E3BF]">كيف يعمل حراك</h2>
        <ol className="relative flex flex-col gap-6">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full font-semibold ${
                  index === steps.length - 1
                    ? "bg-maroon text-white"
                    : "border-[1.5px] border-gold text-gold"
                }`}
              >
                {(index + 1).toLocaleString("ar")}
              </span>
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{step.title}</span>
                <span className="text-sm leading-7 text-gold-soft">{step.body}</span>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </main>
  );
}
