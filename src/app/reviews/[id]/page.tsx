"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  PipelineView,
  ScoreTile,
  scoreColor,
  secondaryButtonClass,
} from "@/components/ui";
import {
  ALIGNMENT_LABELS,
  BLOOM_LABELS,
  ISSUE_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
  SEVERITY_LABELS,
} from "@/lib/labels";
import type { AlignmentStatus, BloomLevel, LanguageIssueType, Review } from "@/types/review";
import { ApiError, fetchJson } from "@/lib/api-client";

type Tab = "summary" | "language" | "standards" | "content" | "source";

const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "الملخص والتوصيات" },
  { id: "language", label: "التدقيق اللغوي" },
  { id: "standards", label: "مطابقة المعايير" },
  { id: "content", label: "تحليل المحتوى" },
  { id: "source", label: "النص المستخرج" },
];

const ALIGNMENT_STYLES: Record<AlignmentStatus, string> = {
  met: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  not_met: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

const SEVERITY_STYLES = {
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  low: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
} as const;

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [review, setReview] = useState<Review | null | undefined>(undefined);
  const [active, setActive] = useState(false);
  const [tab, setTab] = useState<Tab>("summary");
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<{ review: Review; active: boolean }>(`/api/reviews/${params.id}`, {
        cache: "no-store",
      });
      setReview(data.review);
      setActive(data.active);
      setActionError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setReview(null);
      else setActionError(err instanceof Error ? err.message : "تعذر تحميل المراجعة");
    }
  }, [params.id]);

  useEffect(() => {
    // Initial fetch from the API on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const inProgress = review?.status === "queued" || review?.status === "running";
  useEffect(() => {
    if (!inProgress) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [inProgress, load]);

  async function rerun() {
    setActionError(null);
    try {
      await fetchJson(`/api/reviews/${params.id}/run`, { method: "POST" });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "تعذر إعادة التشغيل");
      return;
    }
    await load();
  }

  async function remove() {
    if (!confirm("حذف هذه المراجعة نهائيًا؟")) return;
    try {
      await fetchJson(`/api/reviews/${params.id}`, { method: "DELETE" });
      router.push("/");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "تعذر الحذف");
    }
  }

  if (review === undefined) {
    if (actionError) {
      return <main className="flex-1 p-10 text-center text-sm text-red-500">{actionError}</main>;
    }
    return <main className="flex-1 p-10 text-center text-sm text-neutral-500">جارٍ التحميل...</main>;
  }
  if (review === null) {
    return (
      <main className="mx-auto flex flex-1 flex-col items-center gap-4 p-16 text-center">
        <p className="text-neutral-500">المراجعة غير موجودة.</p>
        <Link href="/" className="text-sm underline">
          العودة إلى اللوحة
        </Link>
      </main>
    );
  }

  // A "running" review with no live worker was interrupted (e.g. server restart).
  const interrupted = inProgress && !active && review.status === "running";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href="/" className="text-sm text-neutral-500 hover:underline print:hidden">
            → اللوحة
          </Link>
          <h1 className="text-2xl font-semibold">{review.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <span>{REVIEW_STATUS_LABELS[review.status]}</span>
            <span>·</span>
            <span>إطار المعايير: {review.frameworkName ?? "بدون"}</span>
            <span>·</span>
            <span>{new Date(review.createdAt).toLocaleString("ar-OM")}</span>
            {review.engine && (
              <>
                <span>·</span>
                <span dir="ltr">{review.engine}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {review.status === "done" && (
            <button onClick={() => window.print()} className={secondaryButtonClass}>
              طباعة / PDF
            </button>
          )}
          <a href={`/api/reviews/${review.id}/export?format=md`} className={secondaryButtonClass}>
            تنزيل Markdown
          </a>
          <a href={`/api/reviews/${review.id}/export?format=json`} className={secondaryButtonClass}>
            تنزيل JSON
          </a>
          {(!inProgress || interrupted) && (
            <button onClick={rerun} className={secondaryButtonClass}>
              إعادة المراجعة
            </button>
          )}
          {!inProgress && (
            <button onClick={remove} className={`${secondaryButtonClass} text-red-600`}>
              حذف
            </button>
          )}
        </div>
      </header>

      {actionError && <p className="text-sm text-red-500">{actionError}</p>}
      {interrupted && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          توقفت هذه المراجعة قبل اكتمالها (ربما بسبب إعادة تشغيل الخادم). اضغط «إعادة المراجعة» لتشغيلها من جديد.
        </p>
      )}

      <section className="flex flex-col gap-2 print:hidden">
        <h2 className="text-sm font-medium text-neutral-500">مسار الأتمتة (وكلاء الذكاء الاصطناعي)</h2>
        <PipelineView stages={review.stages} />
      </section>

      <nav className="flex flex-wrap gap-1 border-b border-neutral-200 print:hidden dark:border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.id ? "border-neutral-900 font-medium dark:border-white" : "border-transparent text-neutral-500"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="print:hidden">
        {tab === "summary" && <SummaryTab review={review} />}
        {tab === "language" && <LanguageTab review={review} />}
        {tab === "standards" && <StandardsTab review={review} />}
        {tab === "content" && <ContentTab review={review} />}
        {tab === "source" && <SourceTab review={review} />}
      </div>

      {/* Print view: every section in sequence. */}
      <div className="hidden flex-col gap-8 print:flex">
        <SummaryTab review={review} />
        <StandardsTab review={review} />
        <ContentTab review={review} />
        <LanguageTab review={review} />
      </div>
    </main>
  );
}

function Pending({ what }: { what: string }) {
  return (
    <p className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
      {what}
    </p>
  );
}

function SummaryTab({ review }: { review: Review }) {
  const report = review.report;
  const profile = review.profile;
  return (
    <div className="flex flex-col gap-6">
      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <ScoreTile label="الدرجة الكلية" score={report.overallScore} />
            <ScoreTile label="سلامة اللغة" score={report.scores.language} />
            <ScoreTile label="المطابقة مع المعايير" score={report.scores.standards} />
            <ScoreTile label="جودة المحتوى" score={report.scores.content} />
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">الملخص التنفيذي</h2>
            <p className="whitespace-pre-line leading-8">{report.executiveSummary}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">أبرز النتائج</h2>
            <ul className="list-disc space-y-1 ps-6 leading-7">
              {report.keyFindings.map((finding, i) => (
                <li key={i}>{finding}</li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">التوصيات حسب الأولوية</h2>
            <ul className="flex flex-col gap-2">
              {[...report.recommendations]
                .sort((a, b) => ["high", "medium", "low"].indexOf(a.priority) - ["high", "medium", "low"].indexOf(b.priority))
                .map((rec, i) => (
                  <li
                    key={i}
                    className="flex flex-col gap-1 rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={SEVERITY_STYLES[rec.priority]}>
                        أولوية {SEVERITY_LABELS[rec.priority]}
                      </Badge>
                      <span className="text-sm font-medium">{rec.area}</span>
                    </div>
                    <p className="text-sm leading-7">{rec.action}</p>
                  </li>
                ))}
            </ul>
          </section>
        </>
      ) : (
        <Pending what="سيظهر التقرير النهائي هنا بعد انتهاء جميع الوكلاء." />
      )}

      {profile && (
        <section className="flex flex-col gap-2 rounded-md bg-neutral-50 p-4 dark:bg-neutral-900">
          <h2 className="text-lg font-semibold">وصف المنهج (من وكيل الاستيعاب)</h2>
          <dl className="grid gap-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="inline text-neutral-500">المادة: </dt>
              <dd className="inline">{profile.subject}</dd>
            </div>
            <div>
              <dt className="inline text-neutral-500">المرحلة: </dt>
              <dd className="inline">{profile.gradeLevel}</dd>
            </div>
            <div>
              <dt className="inline text-neutral-500">اللغة: </dt>
              <dd className="inline">{profile.language}</dd>
            </div>
          </dl>
          <p className="text-sm leading-7">{profile.summary}</p>
          {profile.learningObjectives.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-neutral-500">
                الأهداف المعلنة ({profile.learningObjectives.length})
              </summary>
              <ul className="mt-2 list-disc space-y-1 ps-6">
                {profile.learningObjectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

function LanguageTab({ review }: { review: Review }) {
  const [typeFilter, setTypeFilter] = useState<LanguageIssueType | "all">("all");
  const issues = useMemo(() => review.languageIssues ?? [], [review.languageIssues]);
  const filtered = typeFilter === "all" ? issues : issues.filter((i) => i.type === typeFilter);

  if (!review.languageIssues) {
    return <Pending what="لم يكتمل التدقيق اللغوي بعد." />;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">الأخطاء اللغوية والإملائية ({issues.length})</h2>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as LanguageIssueType | "all")}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm print:hidden dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="all">كل الأنواع</option>
          {Object.entries(ISSUE_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label} ({issues.filter((i) => i.type === key).length})
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <Pending what="لم يرصد الوكيل أخطاء من هذا النوع." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="p-2 text-start font-medium">النوع</th>
                <th className="p-2 text-start font-medium">الخطورة</th>
                <th className="p-2 text-start font-medium">النص الأصلي</th>
                <th className="p-2 text-start font-medium">التصحيح المقترح</th>
                <th className="p-2 text-start font-medium">التوضيح</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((issue, i) => (
                <tr key={i} className="border-t border-neutral-200 align-top dark:border-neutral-800">
                  <td className="p-2">{ISSUE_TYPE_LABELS[issue.type]}</td>
                  <td className="p-2">
                    <Badge className={SEVERITY_STYLES[issue.severity]}>{SEVERITY_LABELS[issue.severity]}</Badge>
                  </td>
                  <td className="p-2">
                    <span className="rounded bg-red-50 px-1 text-red-800 dark:bg-red-950 dark:text-red-200">
                      {issue.original}
                    </span>
                    {!issue.verified && (
                      <div className="text-xs text-amber-600">⚠ لم يُعثر على النص حرفيًا - تحقق يدويًا</div>
                    )}
                  </td>
                  <td className="p-2">
                    <span className="rounded bg-emerald-50 px-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      {issue.suggestion}
                    </span>
                  </td>
                  <td className="p-2 text-neutral-600 dark:text-neutral-400">{issue.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StandardsTab({ review }: { review: Review }) {
  if (!review.frameworkId) {
    return <Pending what="لم يُحدد إطار معايير لهذه المراجعة." />;
  }
  if (!review.alignment) {
    return <Pending what="لم تكتمل المطابقة مع المعايير بعد." />;
  }
  const counts = { met: 0, partial: 0, not_met: 0 };
  for (const a of review.alignment) counts[a.status]++;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">مصفوفة المطابقة: {review.frameworkName}</h2>
      <div className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(counts) as AlignmentStatus[]).map((status) => (
          <Badge key={status} className={ALIGNMENT_STYLES[status]}>
            {ALIGNMENT_LABELS[status]}: {counts[status]}
          </Badge>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {review.alignment.map((a) => (
          <details
            key={a.code}
            className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
            open={a.status !== "met"}
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <Badge className={ALIGNMENT_STYLES[a.status]}>{ALIGNMENT_LABELS[a.status]}</Badge>
              <span className="font-mono text-xs text-neutral-500" dir="ltr">
                {a.code}
              </span>
              <span className="text-sm">{a.description}</span>
            </summary>
            <div className="mt-3 flex flex-col gap-2 text-sm leading-7">
              {a.evidence.length > 0 && (
                <div>
                  <span className="text-neutral-500">الشواهد من النص:</span>
                  <ul className="list-disc ps-6">
                    {a.evidence.map((quote, i) => (
                      <li key={i}>«{quote}»</li>
                    ))}
                  </ul>
                  {!a.evidenceVerified && (
                    <div className="text-xs text-amber-600">
                      ⚠ بعض الشواهد لم يُعثر عليها حرفيًا في النص - تحقق يدويًا
                    </div>
                  )}
                </div>
              )}
              {a.gap && (
                <p>
                  <span className="text-neutral-500">الفجوة: </span>
                  {a.gap}
                </p>
              )}
              {a.recommendation && (
                <p>
                  <span className="text-neutral-500">التوصية: </span>
                  {a.recommendation}
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function ContentTab({ review }: { review: Review }) {
  const content = review.content;
  if (!content) {
    return <Pending what="لم يكتمل تحليل المحتوى بعد." />;
  }
  const bloomTotal = Object.values(content.bloomDistribution).reduce((a, b) => a + b, 0);

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">تحليل المحتوى التربوي</h2>

      <div className="grid gap-3 md:grid-cols-2">
        {content.dimensions.map((d) => (
          <div key={d.key} className="flex flex-col gap-2 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{d.label}</span>
              <span className={`text-xl font-semibold tabular-nums ${scoreColor(d.score)}`}>{d.score}</span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div className="h-1.5 rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${d.score}%` }} />
            </div>
            {d.findings.length > 0 && (
              <ul className="list-disc space-y-1 ps-5 text-sm leading-6">
                {d.findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
            {d.recommendations.length > 0 && (
              <div className="text-sm">
                <span className="text-neutral-500">التوصيات:</span>
                <ul className="list-disc space-y-1 ps-5 leading-6">
                  {d.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">توزيع مستويات تصنيف بلوم (الأهداف والأنشطة والتقويم)</h3>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(BLOOM_LABELS) as BloomLevel[]).map((level) => {
            const count = content.bloomDistribution[level];
            const pct = bloomTotal ? Math.round((count / bloomTotal) * 100) : 0;
            return (
              <div key={level} className="grid grid-cols-[6rem_1fr_4rem] items-center gap-2 text-sm">
                <span>{BLOOM_LABELS[level]}</span>
                <div className="h-3 rounded bg-neutral-100 dark:bg-neutral-800">
                  <div className="h-3 rounded bg-blue-600" style={{ width: `${pct}%` }} />
                </div>
                <span className="tabular-nums text-neutral-500">
                  {count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {content.accuracyConcerns.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">ملاحظات على الدقة العلمية</h3>
          <ul className="flex flex-col gap-2 text-sm leading-7">
            {content.accuracyConcerns.map((c, i) => (
              <li key={i} className="rounded-md bg-amber-50 p-3 dark:bg-amber-950">
                <div>«{c.claim}»</div>
                <div className="text-neutral-600 dark:text-neutral-300">{c.concern}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.strengths.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">نقاط القوة</h3>
          <ul className="list-disc space-y-1 ps-6 text-sm leading-7">
            {content.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SourceTab({ review }: { review: Review }) {
  if (!review.sections.length) {
    return <pre className="whitespace-pre-wrap text-sm leading-7">{review.sourceText}</pre>;
  }
  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">
        قُسّم النص إلى {review.sections.length} مقطعًا لمعالجته بواسطة الوكلاء.
      </p>
      {review.sections.map((section) => (
        <div key={section.index} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="mb-1 text-xs text-neutral-400">
            مقطع {section.index + 1}
            {section.heading && ` — ${section.heading}`}
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-7">{section.text}</pre>
        </div>
      ))}
    </section>
  );
}

