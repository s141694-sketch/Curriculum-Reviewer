"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Curriculum } from "@/types/curriculum";
import { deleteCurriculum, listCurricula } from "@/lib/storage";
import { Diamond } from "@/components/HarakLogo";
import { HeroCompass } from "@/components/HeroCompass";

export default function HomePage() {
  const [curricula, setCurricula] = useState<Curriculum[]>([]);

  useEffect(() => {
    // localStorage is an external store only available client-side; this is
    // the initial read on mount, not a derived-state cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurricula(listCurricula());
  }, []);

  function handleDelete(id: string) {
    deleteCurriculum(id);
    setCurricula(listCurricula());
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 py-12">
      <section className="flex flex-col items-center gap-10 md:flex-row md:justify-between">
        <div className="flex max-w-xl flex-col gap-5">
          <span className="text-sm font-semibold text-gold-ink">أكاديمية السلطان قابوس البحرية</span>
          <h1 className="font-display text-4xl leading-[1.35] font-bold text-navy md:text-5xl">
            صمّم منهجك الدراسي
            <br />
            بخطوات واضحة
          </h1>
          <p className="text-lg leading-8 text-muted">
            صِف المادة والمستوى وأهداف التعلّم والمدة، ويقترح حراك مخططاً منظّماً للوحدات والأهداف
            والموضوعات، يمكنك تعديله مباشرة.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link
              href="/curriculum/new"
              className="harak-press rounded-xl bg-maroon px-6 py-3.5 font-semibold text-white hover:bg-maroon-soft"
            >
              ابدأ منهجاً جديداً
            </Link>
          </div>
        </div>
        <HeroCompass />
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Diamond className="text-gold" />
          <h2 className="font-display text-2xl font-bold text-navy">مناهجي المحفوظة</h2>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>

        {curricula.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gold bg-white p-10 text-center text-muted">
            لا توجد مناهج بعد. أنشئ منهجاً جديداً لتبدأ.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {curricula.map((curriculum) => (
              <li
                key={curriculum.id}
                className="harak-card relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-white p-5"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-gold" aria-hidden="true" />
                <Link href={`/curriculum/${curriculum.id}`} className="flex flex-1 flex-col gap-1.5">
                  <span className="font-display text-xl font-bold text-navy">{curriculum.subject}</span>
                  <span className="text-sm text-muted">
                    {curriculum.level} · {curriculum.durationWeeks} أسبوعاً
                  </span>
                  <span className="mt-2 text-sm font-medium text-gold-ink">
                    {curriculum.modules.length} وحدات
                  </span>
                </Link>
                <button
                  onClick={() => handleDelete(curriculum.id)}
                  className="self-end rounded-lg px-2 py-1 text-sm text-maroon-soft hover:bg-sand"
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
