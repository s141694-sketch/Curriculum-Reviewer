import { NextRequest, NextResponse } from "next/server";
import { reviewToMarkdown } from "@/lib/report-markdown";
import { getReview } from "@/lib/server/store";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/reviews/[id]/export">) {
  const { id } = await ctx.params;
  const review = await getReview(id).catch(() => null);
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const format = request.nextUrl.searchParams.get("format") === "json" ? "json" : "md";
  const baseName = `curriculum-review-${id.slice(0, 8)}`;

  if (format === "json") {
    return new NextResponse(JSON.stringify(review, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.json"`,
      },
    });
  }

  return new NextResponse(reviewToMarkdown(review), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.md"`,
    },
  });
}
