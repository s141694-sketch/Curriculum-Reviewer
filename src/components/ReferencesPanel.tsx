"use client";

import { useState } from "react";
import type { ReferenceItem, ReferenceResult, ReferenceSource } from "@/types/references";

// A collapsible lookup in one external source (Arabic Wikipedia, Open Library
// or OpenAlex). The search box starts from the topic/module title and can be
// edited, e.g. to search research in English.

const SOURCE_LABELS: Record<ReferenceSource, { button: string; credit: string; empty: string }> = {
  wikipedia: {
    button: "مرجع من ويكيبيديا",
    credit: "المصدر: ويكيبيديا العربية (CC BY-SA)",
    empty: "لا توجد مقالة مطابقة. جرّب كلمة أعمّ.",
  },
  books: {
    button: "كتب مقترحة",
    credit: "المصدر: Open Library",
    empty: "لا توجد كتب مطابقة. جرّب عنوانًا أقصر أو بالإنجليزية.",
  },
  research: {
    button: "أبحاث داعمة",
    credit: "المصدر: OpenAlex",
    empty: "لا توجد أبحاث مطابقة. معظم الأبحاث بالإنجليزية، فجرّب كلمات إنجليزية.",
  },
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; items: ReferenceItem[] };

interface Props {
  source: ReferenceSource;
  initialQuery: string;
  compact?: boolean;
}

export function ReferencesPanel({ source, initialQuery, compact = false }: Props) {
  const labels = SOURCE_LABELS[source];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<State>({ status: "idle" });

  async function search(text: string) {
    const q = text.trim();
    if (q.length < 2) {
      setState({ status: "error", message: "اكتب حرفين على الأقل للبحث" });
      return;
    }
    setState({ status: "loading" });
    try {
      const response = await fetch(`/api/enrich/${source}?q=${encodeURIComponent(q)}`);
      const data = (await response.json()) as ReferenceResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "تعذّر البحث");
      setState({ status: "done", items: data.items });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "تعذّر البحث" });
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && state.status === "idle") {
      // Start from the current title each time the panel is first opened.
      setQuery(initialQuery);
      void search(initialQuery);
    }
  }

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-2 rounded-xl border border-line bg-ivory p-3"}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="self-start rounded-lg px-2 py-1 text-sm font-semibold text-navy-soft hover:bg-sand"
      >
        {open ? "▾" : "◂"} {labels.button}
      </button>

      {open && (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void search(query);
            }}
          >
            <input
              aria-label={`بحث: ${labels.button}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="harak-field flex-1 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={state.status === "loading"}
              className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-soft disabled:opacity-60"
            >
              بحث
            </button>
          </form>

          {state.status === "loading" && <p className="text-sm text-muted">جارٍ البحث…</p>}
          {state.status === "error" && (
            <p role="alert" className="text-sm text-maroon">
              {state.message}
            </p>
          )}
          {state.status === "done" && state.items.length === 0 && (
            <p className="text-sm text-muted">{labels.empty}</p>
          )}
          {state.status === "done" && state.items.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {state.items.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  {item.thumbnail && (
                    // External thumbnails of unknown size; next/image would need
                    // every remote host whitelisted for little gain here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail}
                      alt=""
                      loading="lazy"
                      className="h-14 w-11 shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="auto"
                      className="font-semibold text-navy underline-offset-2 hover:text-maroon hover:underline"
                    >
                      {item.title}
                    </a>
                    {item.meta.length > 0 && (
                      <span dir="auto" className="text-xs text-muted">
                        {item.meta.join(" · ")}
                        {item.arabic && source !== "wikipedia" && (
                          <span className="ms-2 rounded bg-sand px-1.5 py-0.5 text-gold-ink">عربي</span>
                        )}
                      </span>
                    )}
                    {item.snippet && <p className="text-sm leading-7 text-ink">{item.snippet}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <span className="text-xs text-muted">{labels.credit}</span>
        </div>
      )}
    </div>
  );
}
