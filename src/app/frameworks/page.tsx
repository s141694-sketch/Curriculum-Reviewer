"use client";

import { useCallback, useEffect, useState } from "react";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { formatStandards, parseStandards } from "@/lib/standards";
import type { StandardsFramework } from "@/types/review";

interface Draft {
  id: string | null;
  name: string;
  description: string;
  source: string;
  standardsText: string;
}

const EMPTY: Draft = { id: null, name: "", description: "", source: "", standardsText: "" };

// Illustrative criteria to get started. These are generic curriculum-quality
// criteria written for this tool, NOT an official standards document: replace
// them with your ministry's or the international framework you adopt.
const EXAMPLE: Draft = {
  id: null,
  name: "معايير جودة عامة (مثال قابل للتعديل)",
  description: "معايير عامة لجودة وثيقة المنهج، للتجربة فقط. استبدلها بالمعايير الرسمية المعتمدة لديكم.",
  source: "مثال توضيحي - ليس وثيقة رسمية",
  standardsText: [
    "Q1 | تتضمن الوثيقة نواتج تعلم واضحة وقابلة للقياس لكل وحدة",
    "Q2 | تتدرج الموضوعات منطقيًا من البسيط إلى المركب مع ربط بالتعلم السابق",
    "Q3 | تتوافق أساليب التقويم مع نواتج التعلم المعلنة",
    "Q4 | تتضمن أنشطة تنمي مهارات التفكير العليا (التحليل والتقويم والإبداع)",
    "Q5 | تربط المحتوى بسياقات من الحياة اليومية والبيئة المحلية",
    "Q6 | تراعي الفروق الفردية وتقدم أنشطة إثرائية وعلاجية",
    "Q7 | تنمي مهارات التواصل والعمل التعاوني",
    "Q8 | توظف التقنية والمصادر الرقمية في التعلم",
    "Q9 | تحدد الزمن المقترح لكل وحدة أو درس",
    "Q10 | تخلو من التحيز وتحترم التنوع الثقافي والاجتماعي",
  ].join("\n"),
};

export default function FrameworksPage() {
  const [frameworks, setFrameworks] = useState<StandardsFramework[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/frameworks", { cache: "no-store" });
    const data = await res.json();
    setFrameworks(data.frameworks ?? []);
  }, []);

  useEffect(() => {
    // Initial fetch from the API on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(draft.id ? `/api/frameworks/${draft.id}` : "/api/frameworks", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر الحفظ");
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function remove(framework: StandardsFramework) {
    if (!confirm(`حذف «${framework.name}»؟ المراجعات السابقة تحتفظ بنتائجها.`)) return;
    await fetch(`/api/frameworks/${framework.id}`, { method: "DELETE" });
    await load();
  }

  const preview = draft ? parseStandards(draft.standardsText) : [];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">أطر المعايير</h1>
          <p className="max-w-2xl text-sm text-neutral-500">
            أضف المعايير الوطنية أو العالمية التي يُطابَق عليها المنهج (مثل معايير الوزارة، أو أطر دولية
            تعتمدونها). الصق كل معيار في سطر بصيغة <code dir="ltr">الرمز | نص المعيار</code>.
          </p>
        </div>
        {!draft && (
          <div className="flex gap-2">
            <button onClick={() => setDraft(EMPTY)} className={primaryButtonClass}>
              إطار جديد
            </button>
            <button onClick={() => setDraft(EXAMPLE)} className={secondaryButtonClass}>
              ابدأ من مثال
            </button>
          </div>
        )}
      </header>

      {draft && (
        <form onSubmit={save} className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
          <label className="flex flex-col gap-1 text-sm">
            اسم الإطار
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            المصدر (الجهة / الوثيقة / الإصدار)
            <input
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            وصف
            <input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            المعايير (معيار في كل سطر)
            <textarea
              required
              rows={12}
              value={draft.standardsText}
              onChange={(e) => setDraft({ ...draft, standardsText: e.target.value })}
              placeholder={"SCI.7.1 | يصف الطالب مكونات الخلية ووظائفها\nSCI.7.2 | ..."}
              className={`${inputClass} font-mono text-sm leading-7`}
            />
          </label>
          <p className="text-xs text-neutral-500">عدد المعايير المقروءة: {preview.length}</p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className={secondaryButtonClass}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      {frameworks.length === 0 && !draft ? (
        <p className="rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          لا توجد أطر معايير بعد.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {frameworks.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{f.name}</p>
                  <p className="text-sm text-neutral-500">
                    {f.standards.length} معيار{f.source && ` · ${f.source}`}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  <button
                    onClick={() =>
                      setDraft({
                        id: f.id,
                        name: f.name,
                        description: f.description,
                        source: f.source,
                        standardsText: formatStandards(f.standards),
                      })
                    }
                    className="text-neutral-500 hover:underline"
                  >
                    تعديل
                  </button>
                  <button onClick={() => remove(f)} className="text-neutral-400 hover:text-red-500">
                    حذف
                  </button>
                </div>
              </div>
              {f.description && <p className="text-sm">{f.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
