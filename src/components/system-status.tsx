"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api-client";

interface Health {
  ok: boolean;
  storage: { ok: boolean; backend: string; message: string };
  llm: { ok: boolean; provider: string; engine: string; message: string };
  platform: string;
}

/**
 * Shows configuration problems (storage, AI engine) before the user uploads
 * anything. Renders nothing when everything is ready.
 */
export function SystemStatus({ onChange }: { onChange?: (ok: boolean) => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<Health>("/api/health", { cache: "no-store" })
      .then((data) => {
        if (cancelled) return;
        setHealth(data);
        onChange?.(data.ok);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "تعذر فحص حالة النظام");
        onChange?.(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onChange]);

  if (error) {
    return <Panel title="تعذر فحص حالة النظام" lines={[error]} />;
  }
  if (!health || health.ok) return null;

  const lines = [
    !health.storage.ok && `التخزين: ${health.storage.message}`,
    !health.llm.ok && `محرك الذكاء الاصطناعي: ${health.llm.message}`,
  ].filter((line): line is string => Boolean(line));

  return <Panel title="النظام غير جاهز للمراجعة بعد" lines={lines} />;
}

function Panel({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <strong>{title}</strong>
      {lines.map((line) => (
        <p key={line} className="leading-7">
          {line}
        </p>
      ))}
    </div>
  );
}
