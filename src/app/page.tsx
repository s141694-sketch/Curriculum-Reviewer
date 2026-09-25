"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SystemStatus } from "@/components/system-status";
import { Badge, primaryButtonClass, scoreColor } from "@/components/ui";
import { REVIEW_STATUS_LABELS } from "@/lib/labels";
import type { ReviewSummary } from "@/types/review";
import { fetchJson } from "@/lib/api-client";

const STATUS_STYLES: Record<ReviewSummary["status"], string> = {
  queued: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export default function DashboardPage() {
  const [reviews, setReviews] = useState<ReviewSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<{ reviews: ReviewSummary[] }>("/api/reviews", { cache: "no-store" });
      setReviews(data.reviews);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل المراجعات");
    }
  }, []);

  useEffect(() => {
    // Initial fetch from the API on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Keep the list fresh while any review is still in progress.
  const anyActive = reviews?.some((r) => r.status === "queued" || r.status === "running");
  useEffect(() => {
    if (!anyActive) return;
    // Every poll lists stored reviews (a billable operation on Vercel Blob), so keep it modest.
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [anyActive, load]);

  const done = reviews?.filter((r) => r.status === "done") ?? [];
  const average =
    done.length && done.some((r) => r.overallScore != null)
      ? Math.round(
          done.reduce((sum, r) => sum + (r.overallScore ?? 0), 0) /
            done.filter((r) => r.overallScore != null).length,
        )
      : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">لوحة مراجعة المناهج</h1>
          <p className="max-w-2xl text-sm text-neutral-500">
            ارفع ملف المنهج، وسيتولى خمسة وكلاء ذكاء اصطناعي المراجعة آليًا: استخراج المحتوى، التدقيق
            الإملائي واللغوي، المطابقة مع المعايير، تحليل المحتوى التربوي، ثم إعداد تقرير شامل.
          </p>
        </div>
        <Link href="/reviews/new" className={primaryButtonClass}>
          مراجعة جديدة
        </Link>
      </header>

      <SystemStatus />

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="إجمالي المراجعات" value={reviews?.length ?? "—"} />
        <Stat
          label="قيد التنفيذ"
          value={reviews?.filter((r) => r.status === "queued" || r.status === "running").length ?? "—"}
        />
        <Stat label="متوسط الدرجة الكلية" value={average ?? "—"} />
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {reviews && reviews.length === 0 && (
        <p className="rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          لا توجد مراجعات بعد. ابدأ بإضافة{" "}
          <Link href="/frameworks" className="underline">
            إطار معايير
          </Link>{" "}
          ثم ارفع أول منهج.
        </p>
      )}

      {reviews && reviews.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="p-3 text-start font-medium">المنهج</th>
                <th className="p-3 text-start font-medium">إطار المعايير</th>
                <th className="p-3 text-start font-medium">الحالة</th>
                <th className="p-3 text-start font-medium">الدرجة</th>
                <th className="p-3 text-start font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="p-3">
                    <Link href={`/reviews/${review.id}`} className="font-medium hover:underline">
                      {review.title}
                    </Link>
                    {review.fileName && (
                      <div className="text-xs text-neutral-500" dir="ltr">
                        {review.fileName}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-neutral-600 dark:text-neutral-400">
                    {review.frameworkName ?? "—"}
                  </td>
                  <td className="p-3">
                    <Badge className={STATUS_STYLES[review.status]}>
                      {REVIEW_STATUS_LABELS[review.status]}
                    </Badge>
                  </td>
                  <td className={`p-3 font-semibold tabular-nums ${scoreColor(review.overallScore)}`}>
                    {review.overallScore ?? "—"}
                  </td>
                  <td className="p-3 text-neutral-500">
                    {new Date(review.createdAt).toLocaleDateString("ar-OM")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
