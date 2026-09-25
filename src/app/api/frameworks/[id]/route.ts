import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/server/http";
import { parseStandards } from "@/lib/standards";
import { deleteFramework, getFramework, saveFramework } from "@/lib/server/store";

export const GET = withErrorHandling(async function GET(_request: NextRequest, ctx: RouteContext<"/api/frameworks/[id]">) {
  const { id } = await ctx.params;
  const framework = await getFramework(id).catch(() => null);
  if (!framework) {
    return NextResponse.json({ error: "Framework not found" }, { status: 404 });
  }
  return NextResponse.json({ framework });
});

export const PUT = withErrorHandling(async function PUT(request: NextRequest, ctx: RouteContext<"/api/frameworks/[id]">) {
  const { id } = await ctx.params;
  const framework = await getFramework(id).catch(() => null);
  if (!framework) {
    return NextResponse.json({ error: "Framework not found" }, { status: 404 });
  }

  let body: { name?: string; description?: string; source?: string; standardsText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const standards =
    body.standardsText !== undefined ? parseStandards(body.standardsText) : framework.standards;
  const name = body.name?.trim() ?? framework.name;
  if (!name || standards.length === 0) {
    return NextResponse.json(
      { error: "A name and at least one standard are required" },
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
  await deleteFramework(id).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
});
