import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, CLAUDE_MODEL } from "@/lib/anthropic";
import type { CurriculumBrief, Module } from "@/types/curriculum";

const SYSTEM_PROMPT = `You are a curriculum design assistant. Given a subject, level, goals, and duration, produce a structured course outline.
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
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Subject: ${brief.subject}\nLevel: ${brief.level}\nGoals: ${brief.goals || "General mastery of the subject"}\nDuration: ${brief.durationWeeks} weeks`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response from model" }, { status: 502 });
    }

    const modules = parseModules(textBlock.text);
    return NextResponse.json({ modules });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
