import { NextRequest, NextResponse } from "next/server";
import { chat, extractJson } from "@/lib/ai";
import type { CurriculumBrief, Module } from "@/types/curriculum";

const SYSTEM_PROMPT = `You are a curriculum design assistant for Harak, a tool used by Sultan Qaboos Naval Academy. Given a subject, level, goals, and duration, produce a structured course outline.

Write ALL text values (module titles, objectives, topic titles, topic descriptions) in Modern Standard Arabic (العربية الفصحى), even if the brief is written in English. Keep JSON keys exactly as given, in English. Write learning objectives as behavioural objectives beginning with a measurable present-tense verb (e.g. "يحدد الطالب…", "يشرح الطالب…").

Respond with ONLY valid JSON matching this TypeScript type, no prose, no markdown fences:

{
  "modules": Array<{
    "title": string,
    "objective": string,
    "durationHours": number,
    "topics": Array<{ "title": string, "description": string }>
  }>
}

Keep module count proportional to the requested duration (roughly 1 module per week is a good default). Each topic description should be one or two sentences.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseModules(raw: string): Array<Omit<Module, "id">> {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || !Array.isArray(parsed.modules)) {
    throw new Error("Malformed response: expected an object with a modules array");
  }

  return parsed.modules.map((moduleValue): Omit<Module, "id"> => {
    if (!isRecord(moduleValue) || !Array.isArray(moduleValue.topics)) {
      throw new Error("Malformed module entry");
    }

    return {
      title: String(moduleValue.title ?? ""),
      objective: String(moduleValue.objective ?? ""),
      durationHours: Number(moduleValue.durationHours ?? 0),
      topics: moduleValue.topics.map((topicValue) => {
        if (!isRecord(topicValue)) {
          throw new Error("Malformed topic entry");
        }
        return {
          id: crypto.randomUUID(),
          title: String(topicValue.title ?? ""),
          description: String(topicValue.description ?? ""),
        };
      }),
    };
  });
}

export async function POST(request: NextRequest) {
  let brief: CurriculumBrief;
  try {
    brief = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!brief.subject || !brief.level || !brief.durationWeeks) {
    return NextResponse.json(
      { error: "subject, level, and durationWeeks are required" },
      { status: 400 },
    );
  }

  try {
    const text = await chat(
      SYSTEM_PROMPT,
      `المادة: ${brief.subject}\nالمستوى: ${brief.level}\nأهداف التعلّم: ${brief.goals || "إتقان عام للمادة"}\nالمدة: ${brief.durationWeeks} أسبوعًا\n\nاكتب المخطط كاملًا بالعربية.`,
    );

    const modules = parseModules(extractJson(text));
    return NextResponse.json({ modules });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
