import { after, NextRequest, NextResponse } from "next/server";
import { normalizeDocumentText } from "@/lib/document-text";
import { withErrorHandling } from "@/lib/server/http";
import { extractText, MAX_UPLOAD_BYTES } from "@/lib/server/extract";
import { checkLlm, primeCredentials } from "@/lib/server/llm";
import { initialStages, runReviewPipeline } from "@/lib/server/pipeline";
import { getFramework, listReviews, saveReview } from "@/lib/server/store";
import type { Review } from "@/types/review";

// The agent pipeline continues after the response (after()); give it the
// longest time a Vercel function may run. Self-hosted servers ignore this.
export const maxDuration = 300;

/** Largest extracted text accepted (about 2,000 pages); larger curricula should be split. */
const MAX_TEXT_CHARS = 4_000_000;

export const GET = withErrorHandling(async function GET() {
  return NextResponse.json({ reviews: await listReviews() });
});

export const POST = withErrorHandling(async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "تعذر قراءة البيانات المرسلة. إن كان الملف كبيرًا جدًا فقسّمه إلى أجزاء أصغر." },
      { status: 400 },
    );
  }

  const title = String(form.get("title") ?? "").trim();
  const frameworkId = String(form.get("frameworkId") ?? "").trim() || null;
  // Browsers send form text with CRLF line breaks; normalise like extracted files.
  const pasted = normalizeDocumentText(String(form.get("text") ?? ""));
  const file = form.get("file");

  let sourceText = pasted;
  // The browser extracts PDF/Word text itself and sends only the text plus the file name.
  let fileName: string | null = String(form.get("fileName") ?? "").trim() || null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "الملف أكبر من 25 ميجابايت. قسّمه إلى أجزاء أصغر." }, { status: 413 });
    }
    fileName = file.name;
    try {
      sourceText = await extractText(file.name, await file.arrayBuffer());
    } catch (error) {
      return NextResponse.json(
        {
          error: `تعذر قراءة الملف: ${error instanceof Error ? error.message : "صيغة غير مدعومة"}. الصيغ المدعومة: PDF نصي، Word (.docx)، TXT، MD.`,
        },
        { status: 400 },
      );
    }
  }

  if (sourceText.length < 50) {
    return NextResponse.json(
      {
        error:
          "لم يُعثر على نص قابل للقراءة (يلزم 50 حرفًا على الأقل). ملفات PDF الممسوحة ضوئيًا تحتاج تحويلًا نصيًا (OCR) قبل الرفع.",
      },
      { status: 400 },
    );
  }

  if (sourceText.length > MAX_TEXT_CHARS) {
    return NextResponse.json(
      { error: "المنهج طويل جدًا لمراجعة واحدة. قسّمه إلى أجزاء (مثلًا كل وحدة في ملف)." },
      { status: 413 },
    );
  }

  const framework = frameworkId ? await getFramework(frameworkId) : null;
  if (frameworkId && !framework) {
    return NextResponse.json({ error: "إطار المعايير المحدد غير موجود. اختر إطارًا آخر." }, { status: 400 });
  }

  // Refuse up front if the AI engine is not usable, instead of failing every stage later.
  const llm = await checkLlm();
  if (!llm.ok) {
    return NextResponse.json({ error: `محرك الذكاء الاصطناعي غير جاهز: ${llm.message}` }, { status: 503 });
  }
  await primeCredentials();

  const now = new Date().toISOString();
  const review: Review = {
    id: crypto.randomUUID(),
    title: title || fileName || "منهج بدون عنوان",
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
});
