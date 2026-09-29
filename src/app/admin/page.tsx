"use client";

import { useEffect, useRef, useState } from "react";
import type { Curriculum } from "@/types/curriculum";
import { listCurricula, saveCurriculum } from "@/lib/storage";
import { ROLE_LABELS, type Role, type Session } from "@/lib/session";
import type { LoginRecord } from "@/lib/users";
import type { AIConfig } from "@/lib/ai";
import { Diamond } from "@/components/HarakLogo";

interface AdminData {
  logins: LoginRecord[];
  ai: AIConfig;
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [showJson, setShowJson] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // initial reads: the session cookie (via the API) and localStorage
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurricula(listCurricula());
    fetch("/api/session").then((r) => r.json()).then((d) => setSession(d.session));
    fetch("/api/admin/users").then((r) => r.json()).then((d) => setData(d.error ? null : d));
  }, []);

  async function clearLog() {
    if (!confirm("حذف سجل الدخول بالكامل؟")) return;
    const r = await fetch("/api/admin/users", { method: "DELETE" });
    const d = await r.json();
    if (r.ok && data) setData({ ...data, logins: d.logins });
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(curricula, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `harak-curricula-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Curriculum[];
      if (!Array.isArray(parsed)) throw new Error("الملف ليس مصفوفة مناهج");
      parsed.forEach((c) => saveCurriculum(c));
      setCurricula(listCurricula());
      setNotice(`استُورد ${parsed.length} منهجًا.`);
    } catch (e) {
      setNotice(e instanceof Error ? `تعذّر الاستيراد: ${e.message}` : "تعذّر الاستيراد");
    }
  }

  const isAdmin = session?.role === "admin";
  const roleCounts = (data?.logins ?? []).reduce<Record<Role, number>>(
    (acc, l) => ({ ...acc, [l.role]: (acc[l.role] ?? 0) + 1 }),
    { member: 0, reviewer: 0, admin: 0 },
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-gold-ink">
          {session ? ROLE_LABELS[session.role] : "لوحة التحكم"}
        </span>
        <h1 className="font-display text-3xl font-bold text-navy md:text-4xl">
          {isAdmin ? "لوحة التحكم بالنظام" : "لوحة المراجعة"}
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="مرات الدخول" value={data?.logins.length ?? 0} />
        <Stat label="مصممو المناهج" value={roleCounts.member} />
        <Stat label="المراجعون" value={roleCounts.reviewer} />
        <Stat label="المسؤولون" value={roleCounts.admin} />
      </div>

      <Section title="المستخدمون الذين دخلوا النظام">
        {data?.logins.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-muted">
                  <th className="px-3 py-2 font-semibold">الاسم</th>
                  <th className="px-3 py-2 font-semibold">الدور</th>
                  <th className="px-3 py-2 font-semibold">وقت الدخول</th>
                </tr>
              </thead>
              <tbody>
                {data.logins.map((l, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold">{l.name}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-[#EDEEF6] px-2.5 py-0.5 text-xs font-semibold text-navy">
                        {ROLE_LABELS[l.role]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted">{new Date(l.at).toLocaleString("ar")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">لا سجلات بعد.</p>
        )}
        {isAdmin && data?.logins.length ? (
          <button
            onClick={clearLog}
            className="self-start rounded-xl border-[1.5px] border-maroon px-4 py-2 text-sm font-semibold text-maroon hover:bg-[#F7E9E9]"
          >
            مسح السجل
          </button>
        ) : null}
      </Section>

      <Section title="بيانات المناهج (JSON)">
        <p className="text-sm text-muted">
          المناهج محفوظة في متصفحك ({curricula.length} منهجًا). صدّرها كنسخة احتياطية أو استوردها من جهاز آخر.
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportJson} className="harak-press rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white">
            تصدير JSON
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="harak-press rounded-xl border-[1.5px] border-navy px-5 py-2.5 text-sm font-semibold text-navy hover:bg-sand"
          >
            استيراد JSON
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            hidden
            onChange={(e) => importJson(e.target.files?.[0])}
          />
          <button
            onClick={() => setShowJson((v) => !v)}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gold-ink hover:bg-sand"
          >
            {showJson ? "إخفاء البيانات" : "عرض البيانات"}
          </button>
        </div>
        {notice && <p className="text-sm text-navy">{notice}</p>}
        {showJson && (
          <pre dir="ltr" className="max-h-96 overflow-auto rounded-xl bg-navy-deep p-4 text-left text-xs leading-relaxed text-gold-soft">
            {JSON.stringify(curricula, null, 2)}
          </pre>
        )}
      </Section>

      {isAdmin && (
        <Section title="إعدادات الذكاء الاصطناعي">
          {data ? (
            <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <Field label="المزوّد" value={data.ai.provider === "open" ? "نموذج مفتوح المصدر (OpenAI-compatible)" : "Anthropic Claude"} />
              <Field label="النموذج" value={data.ai.model} />
              <Field label="الخادم" value={data.ai.baseUrl ?? "api.anthropic.com"} />
            </dl>
          ) : null}
          <p className="text-sm text-muted">
            تُضبط من متغيرات البيئة: <code dir="ltr">AI_PROVIDER</code>، <code dir="ltr">AI_BASE_URL</code>،{" "}
            <code dir="ltr">AI_MODEL</code>، <code dir="ltr">AI_API_KEY</code>. انظر <code dir="ltr">.env.example</code>.
          </p>
        </Section>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
      <div className="flex items-center gap-3">
        <Diamond size={10} className="text-gold" />
        <h2 className="font-display text-xl font-bold text-navy">{title}</h2>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border-t-4 border-gold bg-white p-4 text-center">
      <div className="font-display text-3xl font-bold text-navy">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ivory p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd dir="ltr" className="mt-1 text-right font-semibold text-navy">
        {value}
      </dd>
    </div>
  );
}
