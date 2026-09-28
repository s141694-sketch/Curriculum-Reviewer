"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import academyEmblem from "@/assets/academy-emblem.webp";
import { HarakWordmark } from "./HarakLogo";

const links = [
  { href: "/", label: "مناهجي" },
  { href: "/curriculum/new", label: "منهج جديد" },
];

export function SiteHeader() {
  const pathname = usePathname();

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
        <nav aria-label="التنقل الرئيسي" className="flex items-center gap-8 text-[15px] font-medium">
          {links.map((link) => {
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
      </div>
    </header>
  );
}
