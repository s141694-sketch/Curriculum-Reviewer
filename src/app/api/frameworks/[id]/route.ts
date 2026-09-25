import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/server/http";
import { parseStandards } from "@/lib/standards";
import { deleteFramework, getFramework, saveFramework } from "@/lib/server/store";

export const GET = withErrorHandling(async function GET(_request: NextRequest, ctx: RouteContext<"/api/frameworks/[id]">) {
  const { id } = await ctx.params;
  const framework = await getFramework(id);
  if (!framework) {
    return NextResponse.json({ error: "إطار المعايير غير موجود." }, { status: 404 });
  }
  return NextResponse.json({ framework });
});

export const PUT = withErrorHandling(async function PUT(request: NextRequest, ctx: RouteContext<"/api/frameworks/[id]">) {
  const { id } = await ctx.params;
  const framework = await getFramework(id);
  if (!framework) {
    return NextResponse.json({ error: "إطار المعايير غير موجود." }, { status: 404 });
  }

  let body: { name?: string; description?: string; source?: string; standardsText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 });
  }

  const standards =
    body.standardsText !== undefined ? parseStandards(body.standardsText) : framework.standards;
  const name = body.name?.trim() ?? framework.name;
  if (!name || standards.length === 0) {
    return NextResponse.json(
      { error: "يلزم اسم للإطار ومعيار واحد على الأقل." },
      { status: 400 },
    );
  }

  const updated = {
    ...framework,
    name,
    description: body.description?.trim() ?? framework.description,
    source: body.source?.trim() ?? framework.source,
    standards,
    updatedAt: new Date().toISOString(),
  };
  await saveFramework(updated);
  return NextResponse.json({ framework: updated });
});

export const DELETE = withErrorHandling(async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/frameworks/[id]">) {
  const { id } = await ctx.params;
  await deleteFramework(id);
  return new NextResponse(null, { status: 204 });
});
