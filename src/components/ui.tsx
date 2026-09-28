import { STAGE_LABELS, STAGE_STATUS_LABELS } from "@/lib/labels";
import type { StageState, StageStatus } from "@/types/review";

export const inputClass =
  "rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900";

export const primaryButtonClass =
  "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";

export const secondaryButtonClass =
  "rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

const STATUS_STYLES: Record<StageStatus, string> = {
  pending: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  skipped: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

export function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function StageBadge({ status }: { status: StageStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{STAGE_STATUS_LABELS[status]}</Badge>;
}

export function scoreColor(score: number | null): string {
  if (score == null) return "text-neutral-400";
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function ScoreTile({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className={`text-3xl font-semibold tabular-nums ${scoreColor(score)}`}>
        {score ?? "—"}
        {score != null && <span className="text-base font-normal text-neutral-400">/100</span>}
      </span>
    </div>
  );
}

/** The five-agent pipeline, one row per stage. */
export function PipelineView({ stages }: { stages: StageState[] }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {stages.map((stage, index) => (
        <li
          key={stage.id}
          className="flex flex-col gap-1 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-400">المرحلة {index + 1}</span>
            <StageBadge status={stage.status} />
          </div>
          <span className="font-medium">{STAGE_LABELS[stage.id].agent}</span>
          <span className="text-xs text-neutral-500">{STAGE_LABELS[stage.id].name}</span>
          {stage.status === "running" && stage.progress && (
            <span className="text-xs text-blue-700 dark:text-blue-300">الدفعات: {stage.progress}</span>
          )}
          {stage.error && <span className="text-xs text-red-600 dark:text-red-400">{stage.error}</span>}
        </li>
      ))}
    </ol>
  );
}
