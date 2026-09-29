"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CompassMark, HarakWordmark } from "@/components/HarakLogo";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/session";

const roleHints: Record<Role, string> = {
  member: "إنشاء المناهج وتعديلها.",
  reviewer: "كل ما سبق، مع لوحة المراجعة: المستخدمون وبيانات JSON.",
  admin: "كل ما سبق، مع التحكم الكامل بالنظام.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذّر تسجيل الدخول");
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ ما");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-navy">
        <HarakWordmark size={72} />
        <span className="text-sm font-semibold text-gold-ink">بوصلة المنهج الدراسي</span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-3xl border border-line bg-white p-8"
      >
        <h1 className="font-display text-2xl font-bold text-navy">اختر دورك للدخول</h1>

        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          الاسم
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسمك الكامل"
            className="harak-field text-base font-normal"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold">الدور</legend>
          {ROLES.map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                role === option ? "border-navy bg-ivory" : "border-line hover:bg-sand"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
                className="mt-1 accent-maroon"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{ROLE_LABELS[option]}</span>
                <span className="text-sm text-muted">{roleHints[option]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {error && (
          <p role="alert" className="rounded-xl bg-[#F7E9E9] px-4 py-3 text-sm text-maroon">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="harak-press flex items-center justify-center gap-2 rounded-xl bg-maroon px-6 py-3.5 font-semibold text-white hover:bg-maroon-soft disabled:opacity-70"
        >
          {loading ? <CompassMark size={20} spinning className="text-gold-soft" /> : null}
          دخول
        </button>
      </form>
    </main>
  );
}
