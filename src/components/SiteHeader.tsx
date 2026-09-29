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
    <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" aria-label="حراك — الصفحة الرئيسية" className="group flex items-center gap-4 text-navy">
          <HarakWordmark size={36} />
          <span className="h-11 w-px bg-gold" aria-hidden="true" />
          <Image
            src={academyEmblem}
            alt="شعار أكاديمية السلطان قابوس البحرية"
            className="h-14 w-auto"
            priority
          />
        </Link>
        {!onLogin && (
          <nav aria-label="التنقل الرئيسي" className="flex items-center gap-8 text-[15px] font-medium">
            {nav.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`harak-nav ${active ? "text-maroon" : "text-navy hover:text-maroon"}`}
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
              <span className="text-sm font-semibold text-navy">{session.name}</span>
              <span className="text-xs text-gold-ink">{ROLE_LABELS[session.role]}</span>
            </div>
            <button
              onClick={logout}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-maroon hover:text-maroon"
            >
              خروج
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
