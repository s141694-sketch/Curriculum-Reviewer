import { after, NextRequest, NextResponse } from "next/server";
import { extractText, MAX_UPLOAD_BYTES } from "@/lib/server/extract";
import { initialStages, runReviewPipeline } from "@/lib/server/pipeline";
import { getFramework, listReviews, saveReview } from "@/lib/server/store";
import type { Review } from "@/types/review";

export async function GET() {
  return NextResponse.json({ reviews: await listReviews() });
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const frameworkId = String(form.get("frameworkId") ?? "").trim() || null;
  const pasted = String(form.get("text") ?? "").trim();
  const file = form.get("file");

  let sourceText = pasted;
  let fileName: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is larger than 25 MB" }, { status: 413 });
    }
    fileName = file.name;
    try {
      sourceText = await extractText(file.name, await file.arrayBuffer());
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not read file" },
        { status: 400 },
      );
    }
  }

  if (sourceText.length < 50) {
    return NextResponse.json(
      {
        error:
          "No readable text found (at least 50 characters needed). Scanned PDFs need OCR before upload.",
      },
      { status: 400 },
    );
  }

  const framework = frameworkId ? await getFramework(frameworkId) : null;
  if (frameworkId && !framework) {
    return NextResponse.json({ error: "Standards framework not found" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const review: Review = {
    id: crypto.randomUUID(),
    title: title || fileName || "Untitled curriculum",
    fileName,
    frameworkId: framework?.id ?? null,
    frameworkName: framework?.name ?? null,
    status: "queued",
    stages: initialStages(Boolean(framework)),
    createdAt: now,
    updatedAt: now,
    engine: "",
    sourceText,
    sections: [],
    profile: null,
    languageIssues: null,
    alignment: null,
    content: null,
    report: null,
  };
  await saveReview(review);

  // Run the agent pipeline after responding; the client polls for progress.
  after(() => runReviewPipeline(review.id));

  return NextResponse.json({ id: review.id }, { status: 201 });
}
