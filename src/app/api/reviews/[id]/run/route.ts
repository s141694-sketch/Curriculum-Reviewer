import { after, NextRequest, NextResponse } from "next/server";
import { isRunning, runReviewPipeline } from "@/lib/server/pipeline";
import { getReview } from "@/lib/server/store";

/** Re-run the full agent pipeline for an existing review (e.g. after a failure). */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/reviews/[id]/run">) {
  const { id } = await ctx.params;
  const review = await getReview(id).catch(() => null);
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  if (isRunning(id)) {
    return NextResponse.json({ error: "Review is already running" }, { status: 409 });
  }
  after(() => runReviewPipeline(id));
  return NextResponse.json({ id }, { status: 202 });
}
