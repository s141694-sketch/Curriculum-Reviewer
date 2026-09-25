import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/anthropic";

// Single entry point every agent uses to talk to a model. Two providers:
//
// - "anthropic": Claude via the Anthropic API. Best quality, but document text
//   leaves the internal network.
// - "ollama": a model served on your own hardware through Ollama. Nothing
//   leaves the server - use this when curriculum content must stay internal.
//
// Select with LLM_PROVIDER in the environment.

export type Effort = "low" | "medium" | "high";

export interface StructuredRequest<T extends z.ZodType> {
  /** Short agent name, used in error messages. */
  agent: string;
  system: string;
  user: string;
  schema: T;
  effort?: Effort;
}

type Provider = "anthropic" | "ollama";

function provider(): Provider {
  const value = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  if (value !== "anthropic" && value !== "ollama") {
    throw new Error(`Unsupported LLM_PROVIDER "${value}" (expected "anthropic" or "ollama")`);
  }
  return value;
}

const CLAUDE_REVIEW_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:14b";

/** Label stored on each review so results are traceable to the engine that produced them. */
export function engineLabel(): string {
  return provider() === "anthropic"
    ? `anthropic:${CLAUDE_REVIEW_MODEL}`
    : `ollama:${OLLAMA_MODEL}`;
}

/** Rough per-request input budget in characters; documents above it are processed in chunks. */
export function contextBudgetChars(): number {
  const fromEnv = Number(process.env.LLM_CONTEXT_CHARS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  // Claude models take ~1M tokens; local models are usually configured far smaller.
  return provider() === "anthropic" ? 400_000 : 24_000;
}

export async function generateStructured<T extends z.ZodType>(
  request: StructuredRequest<T>,
): Promise<z.infer<T>> {
  return provider() === "anthropic" ? viaAnthropic(request) : viaOllama(request);
}

async function viaAnthropic<T extends z.ZodType>(request: StructuredRequest<T>): Promise<z.infer<T>> {
  const client = getAnthropicClient();
  // Server-side refusal fallback is only offered on the newest tiers.
  const supportsFallback = /^claude-(opus-5|fable-5)/.test(CLAUDE_REVIEW_MODEL);

  let response;
  try {
    response = await client.beta.messages.parse({
      model: CLAUDE_REVIEW_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: request.effort ?? "high",
        format: betaZodOutputFormat(request.schema),
      },
      ...(supportsFallback
        ? { betas: ["server-side-fallback-2026-06-01"], fallbacks: [{ model: "claude-opus-4-8" }] }
        : {}),
      system: request.system,
      messages: [{ role: "user", content: request.user }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error(`${request.agent}: invalid ANTHROPIC_API_KEY`);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new Error(`${request.agent}: rate limited by the Claude API, retry later`);
    }
    if (error instanceof Anthropic.APIError) {
      throw new Error(`${request.agent}: Claude API error ${error.status ?? ""} ${error.message}`);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new Error(`${request.agent}: the model declined this request`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(`${request.agent}: response was cut off (max_tokens); try a smaller document`);
  }
  if (response.parsed_output == null) {
    throw new Error(`${request.agent}: model returned no parseable output`);
  }
  return response.parsed_output as z.infer<T>;
}

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

async function viaOllama<T extends z.ZodType>(request: StructuredRequest<T>): Promise<z.infer<T>> {
  const jsonSchema = z.toJSONSchema(request.schema);
  let lastError: unknown;

  // Local models occasionally emit invalid JSON; one retry fixes most cases.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: jsonSchema,
        options: {
          temperature: 0,
          num_ctx: Number(process.env.OLLAMA_NUM_CTX) || 16384,
        },
        messages: [
          {
            role: "system",
            content: `${request.system}\n\nRespond ONLY with JSON that matches this schema:\n${JSON.stringify(jsonSchema)}`,
          },
          { role: "user", content: request.user },
        ],
      }),
    });

    const body = (await res.json().catch(() => ({}))) as OllamaChatResponse;
    if (!res.ok) {
      throw new Error(`${request.agent}: Ollama error ${res.status} ${body.error ?? ""}`);
    }

    try {
      return request.schema.parse(JSON.parse(body.message?.content ?? ""));
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `${request.agent}: local model returned invalid JSON (${lastError instanceof Error ? lastError.message : "unknown"})`,
  );
}
