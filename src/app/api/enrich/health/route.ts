import { NextRequest, NextResponse } from "next/server";
import { signedInSession } from "@/lib/external/guard";
import { runAllProbes } from "@/lib/external/health";

// GET /api/enrich/health — live check of every candidate API (bd: cr-ekm.1).
export async function GET(request: NextRequest) {
  if (!(await signedInSession())) {
    return NextResponse.json({ error: "سجّل الدخول أولًا" }, { status: 401 });
  }

  const results = await runAllProbes(request.nextUrl.origin);
  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    host: process.env.VERCEL ? `vercel:${process.env.VERCEL_REGION ?? "?"}` : "local",
    passed: results.filter((r) => r.ok).length,
    total: results.length,
    results,
  });
}
