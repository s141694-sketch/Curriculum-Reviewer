import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/server/http";
import { isActive } from "@/lib/server/pipeline";
import { deleteReview, getReview } from "@/lib/server/store";

export const GET = withErrorHandling(async function GET(_request: NextRequest, ctx: RouteContext<"/api/reviews/[id]">) {
  const { id } = await ctx.params;
  const review = await getReview(id);
  if (!review) {
    return NextResponse.json({ error: "المراجعة غير موجودة." }, { status: 404 });
  }
  // `active` is false for a review left "running" by a restart or timeout, so the UI can offer to resume.
  return NextResponse.json({ review, active: isActive(review) });
});

export const DELETE = withErrorHandling(async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/reviews/[id]">) {
  const { id } = await ctx.params;
  const review = await getReview(id);
  if (review && isActive(review)) {
    return NextResponse.json({ error: "لا يمكن حذف المراجعة أثناء تشغيلها." }, { status: 409 });
  }
  await deleteReview(id);
  return new NextResponse(null, { status: 204 });
});
