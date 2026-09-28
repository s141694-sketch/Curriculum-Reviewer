import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "مراجع المناهج | Curriculum Reviewer",
  description: "مراجعة المناهج آليًا بوكلاء الذكاء الاصطناعي: تدقيق لغوي، مطابقة معايير، وتحليل محتوى",
};

const NAV = [
  { href: "/", label: "لوحة المراجعات" },
  { href: "/reviews/new", label: "مراجعة جديدة" },
  { href: "/frameworks", label: "أطر المعايير" },
  { href: "/curriculum", label: "تصميم منهج" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-neutral-200 print:hidden dark:border-neutral-800">
          <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
            <Link href="/" className="font-semibold">
              مراجع المناهج
            </Link>
            <div className="flex flex-wrap gap-4 text-sm text-neutral-600 dark:text-neutral-400">
              {NAV.slice(1).map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-neutral-900 dark:hover:text-white">
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
