import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/server/http";
import { isRunning } from "@/lib/server/pipeline";
import { deleteReview, getReview } from "@/lib/server/store";

export const GET = withErrorHandling(async function GET(_request: NextRequest, ctx: RouteContext<"/api/reviews/[id]">) {
  const { id } = await ctx.params;
  const review = await getReview(id).catch(() => null);
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  // `active` is false for a review left "running" by a server restart, so the UI can offer a re-run.
  return NextResponse.json({ review, active: isRunning(id) });
});

export const DELETE = withErrorHandling(async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/reviews/[id]">) {
  const { id } = await ctx.params;
  if (isRunning(id)) {
    return NextResponse.json({ error: "Review is still running" }, { status: 409 });
  }
  await deleteReview(id).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
});
