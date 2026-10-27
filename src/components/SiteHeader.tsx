"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import academyEmblem from "@/assets/academy-emblem.webp";
import { isElevated, ROLE_LABELS, type Session } from "@/lib/session";
import { HarakWordmark } from "./HarakLogo";

const links = [
  { href: "/", label: "مناهجي" },
  { href: "/curriculum/new", label: "منهج جديد" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // the session lives in an httpOnly cookie, so ask the server who we are
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setSession(d.session))
      .catch(() => setSession(null));
  }, [pathname]);

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setSession(null);
    router.push("/login");
    router.refresh();
  }

  const onLogin = pathname === "/login";
  const nav = session && isElevated(session.role) ? [...links, { href: "/admin", label: "لوحة التحكم" }] : links;

  return (
    <header className="harak-on-ocean relative top-0 z-20 bg-ocean md:sticky text-ivory shadow-[0_1px_0_rgba(10,31,68,0.18)]">
      <div className="mx-auto flex min-h-20 w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3">
        <Link href="/" aria-label="حراك — الصفحة الرئيسية" className="group flex items-center gap-4 text-ivory">
          <HarakWordmark size={36} tone="reverse" />
          <span className="h-11 w-px bg-sky" aria-hidden="true" />
          <span className="grid size-14 place-items-center rounded-full bg-ivory">
            <Image
              src={academyEmblem}
              alt="شعار أكاديمية السلطان قابوس البحرية"
              className="h-12 w-auto"
              priority
            />
          </span>
        </Link>
        {!onLogin && (
          <nav aria-label="التنقل الرئيسي" className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
            {nav.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full border px-4 py-2 transition-colors ${
                    active
                      ? "border-ivory bg-ivory font-semibold text-ocean"
                      : "border-[#5B8FC4] text-ice hover:border-ivory hover:text-ivory"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
        {session && !onLogin && (
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end leading-tight">
              <span className="text-sm font-semibold text-ivory">{session.name}</span>
              <span className="text-xs text-ice">{ROLE_LABELS[session.role]}</span>
            </div>
            <button
              onClick={logout}
              className="rounded-full border border-[#5B8FC4] px-4 py-1.5 text-xs font-semibold text-ice transition-colors hover:border-ivory hover:text-ivory"
            >
              خروج
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
