import { getAnthropicClient, CLAUDE_MODEL } from "./anthropic";

// Two providers behind one call:
//  - "open": any OpenAI-compatible chat endpoint serving an open-weights model
//    (Ollama locally, or a hosted API). Default is Qwen 2.5 on Ollama, chosen
//    for its Arabic quality among open models.
//  - "anthropic": the Claude API via the official SDK.
// AI_PROVIDER picks one; when unset, "open" is used unless only an Anthropic
// key is configured.

export type Provider = "open" | "anthropic";

export interface AIConfig {
  provider: Provider;
  model: string;
  baseUrl?: string;
}

export function aiConfig(): AIConfig {
  const explicit = process.env.AI_PROVIDER as Provider | undefined;
  const provider: Provider =
    explicit === "open" || explicit === "anthropic"
      ? explicit
      : process.env.ANTHROPIC_API_KEY && !process.env.AI_BASE_URL
        ? "anthropic"
        : "open";

  if (provider === "anthropic") return { provider, model: CLAUDE_MODEL };
  return {
    provider,
    model: process.env.AI_MODEL || "qwen2.5:14b",
    baseUrl: (process.env.AI_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, ""),
  };
}

export async function chat(system: string, user: string): Promise<string> {
  const config = aiConfig();

  if (config.provider === "anthropic") {
    const message = await getAnthropicClient().messages.create({
      model: config.model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = message.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("لم يُعِد النموذج نصًا");
    return block.text;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.AI_API_KEY) headers.Authorization = `Bearer ${process.env.AI_API_KEY}`;

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      temperature: 0.4,
      max_tokens: 4096,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  }).catch((e: Error) => {
    throw new Error(`تعذّر الوصول إلى خادم النموذج (${config.baseUrl}): ${e.message}`);
  });

  if (!response.ok) {
    throw new Error(`خادم النموذج ردّ بخطأ ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("لم يُعِد النموذج نصًا");
  return text;
}

/** Strip ```json fences some open models add despite instructions. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}
