import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/server/http";
import { parseStandards } from "@/lib/standards";
import { listFrameworks, saveFramework } from "@/lib/server/store";
import type { StandardsFramework } from "@/types/review";

export const GET = withErrorHandling(async function GET() {
  return NextResponse.json({ frameworks: await listFrameworks() });
});

export const POST = withErrorHandling(async function POST(request: NextRequest) {
  let body: { name?: string; description?: string; source?: string; standardsText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const standards = parseStandards(body.standardsText ?? "");
  if (!name || standards.length === 0) {
    return NextResponse.json(
      { error: "A name and at least one standard are required" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const framework: StandardsFramework = {
    id: crypto.randomUUID(),
    name,
    description: body.description?.trim() ?? "",
    source: body.source?.trim() ?? "",
    standards,
    createdAt: now,
    updatedAt: now,
  };
  await saveFramework(framework);
  return NextResponse.json({ framework }, { status: 201 });
});
