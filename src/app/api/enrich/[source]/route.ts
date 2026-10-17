import { NextRequest, NextResponse } from "next/server";
import type { ReferenceItem, ReferenceResult, ReferenceSource } from "@/types/references";
import { cleanQuery, signedInSession } from "@/lib/external/guard";
import { UpstreamError } from "@/lib/external/http";
import { searchWikipedia } from "@/lib/external/wikipedia";
import { searchOpenLibrary } from "@/lib/external/openlibrary";
import { searchOpenAlex } from "@/lib/external/openalex";

// GET /api/enrich/{wikipedia|books|research}?q=…
// Server-side lookups in the sources chosen in docs/external-apis.md.

const SEARCHERS: Record<ReferenceSource, (query: string) => Promise<ReferenceItem[]>> = {
  wikipedia: (q) => searchWikipedia(q),
  books: (q) => searchOpenLibrary(q),
  research: (q) => searchOpenAlex(q),
};

function isSource(value: string): value is ReferenceSource {
  return value in SEARCHERS;
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/enrich/[source]">) {
  if (!(await signedInSession())) {
    return NextResponse.json({ error: "سجّل الدخول أولًا" }, { status: 401 });
  }

  const { source } = await ctx.params;
  if (!isSource(source)) {
    return NextResponse.json({ error: "مصدر غير معروف" }, { status: 404 });
  }

  const query = cleanQuery(request.nextUrl.searchParams.get("q"));
  if (!query) {
    return NextResponse.json({ error: "اكتب حرفين على الأقل للبحث" }, { status: 400 });
  }

  try {
    const result: ReferenceResult = { source, query, items: await SEARCHERS[source](query) };
    return NextResponse.json(result);
  } catch (error) {
    console.error(`enrich/${source} failed:`, error);
    const status = error instanceof UpstreamError && error.status === 429 ? 429 : 502;
    return NextResponse.json(
      { error: status === 429 ? "المصدر مشغول الآن، حاول بعد قليل" : "تعذّر الوصول إلى المصدر الخارجي" },
      { status },
    );
  }
}
