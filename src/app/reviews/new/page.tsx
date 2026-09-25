"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { inputClass, primaryButtonClass } from "@/components/ui";
import type { StandardsFramework } from "@/types/review";

export default function NewReviewPage() {
  const router = useRouter();
  const [frameworks, setFrameworks] = useState<StandardsFramework[]>([]);
  const [title, setTitle] = useState("");
  const [frameworkId, setFrameworkId] = useState("");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/frameworks")
      .then((res) => res.json())
      .then((data) => {
        const list: StandardsFramework[] = data.frameworks ?? [];
        setFrameworks(list);
        if (list.length) setFrameworkId((current) => current || list[0].id);
      })
      .catch(() => setFrameworks([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData();
    form.set("title", title);
    form.set("frameworkId", frameworkId);
    if (mode === "file" && file) form.set("file", file);
    if (mode === "text") form.set("text", text);

    try {
      const res = await fetch("/api/reviews", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر بدء المراجعة");
      router.push(`/reviews/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر بدء المراجعة");
      setSubmitting(false);
    }
  }

  const canSubmit = mode === "file" ? Boolean(file) : text.trim().length >= 50;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">مراجعة منهج جديد</h1>
        <p className="text-sm text-neutral-500">
          الصيغ المدعومة: Word (.docx) و PDF نصي و .txt و .md. ملفات PDF الممسوحة ضوئيًا تحتاج تحويلًا
          نصيًا (OCR) قبل الرفع.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm">
          عنوان المراجعة
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: العلوم - الصف السابع - الفصل الأول"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          إطار المعايير للمطابقة
          <select value={frameworkId} onChange={(e) => setFrameworkId(e.target.value)} className={inputClass}>
            <option value="">بدون مطابقة معايير (تدقيق لغوي وتحليل محتوى فقط)</option>
            {frameworks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.standards.length} معيار)
              </option>
            ))}
          </select>
          {frameworks.length === 0 && (
            <span className="text-xs text-neutral-500">
              لا توجد أطر معايير بعد.{" "}
              <Link href="/frameworks" className="underline">
                أضف إطارًا
              </Link>{" "}
              لتفعيل المطابقة.
            </span>
          )}
        </label>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm">محتوى المنهج</legend>
          <div className="flex gap-2 text-sm">
            {(["file", "text"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-md px-3 py-1.5 ${mode === value ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "border border-neutral-300 dark:border-neutral-700"}`}
              >
                {value === "file" ? "رفع ملف" : "لصق النص"}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <input
              type="file"
              accept=".docx,.pdf,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={`${inputClass} text-sm`}
            />
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              placeholder="الصق نص المنهج هنا..."
              className={`${inputClass} text-sm leading-7`}
            />
          )}
        </fieldset>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={!canSubmit || submitting} className={`${primaryButtonClass} self-start`}>
          {submitting ? "جارٍ الرفع وبدء المراجعة..." : "ابدأ المراجعة الآلية"}
        </button>
      </form>
    </main>
  );
}
