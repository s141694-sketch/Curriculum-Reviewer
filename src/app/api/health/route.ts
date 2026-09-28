import { NextResponse } from "next/server";
import { describeError, withErrorHandling } from "@/lib/server/http";
import { checkLlm } from "@/lib/server/llm";
import { checkStorage, storageBackend } from "@/lib/server/store";

// Readiness of the two things every review depends on. The UI shows the
// result as a banner, so configuration problems surface before an upload.
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async function GET() {
  const [storage, llm] = await Promise.all([
    checkStorage().then(
      () => ({ ok: true, backend: storageBackend(), message: "التخزين يعمل." }),
      (error) => ({ ok: false, backend: storageBackend(), message: describeError(error) }),
    ),
    checkLlm(),
  ]);
  return NextResponse.json({
    ok: storage.ok && llm.ok,
    storage,
    llm,
    platform: process.env.VERCEL ? "vercel" : "self-hosted",
  });
});
