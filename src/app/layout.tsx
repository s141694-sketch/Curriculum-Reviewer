import type { Metadata } from "next";
import { El_Messiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { Wallpaper } from "@/components/Wallpaper";
import "./globals.css";

const messiri = El_Messiri({
  variable: "--font-messiri",
  subsets: ["arabic", "latin"],
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "حراك",
  description: "حراك — بوصلة المنهج الدراسي. أكاديمية السلطان قابوس البحرية.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${messiri.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <body className="isolate flex min-h-full flex-col font-sans text-ink">
        <Wallpaper />
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
