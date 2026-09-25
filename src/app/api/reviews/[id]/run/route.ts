import { after, NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/server/http";
import { checkLlm, primeCredentials } from "@/lib/server/llm";
import { isActive, runReviewPipeline } from "@/lib/server/pipeline";
import { getReview } from "@/lib/server/store";

export const maxDuration = 300;

/**
 * Run the agents again for an existing review. `?mode=resume` (default for a
 * review that did not finish) keeps completed stages; `?mode=full` starts over.
 */
export const POST = withErrorHandling(async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/reviews/[id]/run">,
) {
  const { id } = await ctx.params;
  const review = await getReview(id);
  if (!review) {
    return NextResponse.json({ error: "المراجعة غير موجودة." }, { status: 404 });
  }
  if (isActive(review)) {
    return NextResponse.json({ error: "المراجعة قيد التشغيل حاليًا." }, { status: 409 });
  }
  const llm = await checkLlm();
  if (!llm.ok) {
    return NextResponse.json({ error: `محرك الذكاء الاصطناعي غير جاهز: ${llm.message}` }, { status: 503 });
  }
  await primeCredentials();

  const mode = request.nextUrl.searchParams.get("mode");
  const resume = mode ? mode === "resume" : review.status !== "done";
  after(() => runReviewPipeline(id, { resume }));
  return NextResponse.json({ id, resume }, { status: 202 });
});
