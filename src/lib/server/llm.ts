import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getVercelOidcToken } from "@vercel/oidc";
import { z } from "zod";

// Single entry point every agent uses to talk to a model. Providers:
//
// - "ollama":    a model on your own hardware via Ollama. Nothing leaves the
//                server - the target setup for the internal deployment.
// - "anthropic": Claude through the Anthropic API (needs ANTHROPIC_API_KEY).
// - "gateway":   Claude through Vercel AI Gateway. On Vercel it authenticates
//                with the deployment's OIDC token, so no key is needed.
//
// LLM_PROVIDER selects one explicitly; otherwise: ANTHROPIC_API_KEY ->
// anthropic, running on Vercel or AI_GATEWAY_API_KEY -> gateway, else ollama.

export type Effort = "low" | "medium" | "high";
export type Provider = "anthropic" | "gateway" | "ollama";

export interface StructuredRequest<T extends z.ZodType> {
  /** Short agent name, used in error messages. */
  agent: string;
  system: string;
  user: string;
  schema: T;
  effort?: Effort;
}

const GATEWAY_URL = "https://ai-gateway.vercel.sh";
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:14b";
const CLAUDE_REVIEW_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

export class LlmConfigError extends Error {}

export function provider(): Provider {
  const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (explicit) {
    if (explicit === "anthropic" || explicit === "gateway" || explicit === "ollama") return explicit;
    throw new LlmConfigError(
      `قيمة LLM_PROVIDER غير مدعومة: "${explicit}". القيم المتاحة: ollama أو anthropic أو gateway.`,
    );
  }
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.VERCEL || process.env.AI_GATEWAY_API_KEY) return "gateway";
  return "ollama";
}

function claudeModelId(name: string): string {
  // AI Gateway addresses models as "anthropic/<model>".
  return provider() === "gateway" && !name.includes("/") ? `anthropic/${name}` : name;
}

/** Label stored on each review so results are traceable to the engine that produced them. */
export function engineLabel(): string {
  const p = provider();
  return p === "ollama" ? `ollama:${OLLAMA_MODEL}` : `${p}:${claudeModelId(CLAUDE_REVIEW_MODEL)}`;
}

/** Rough per-request input budget in characters; documents above it are processed in chunks. */
export function contextBudgetChars(): number {
  const fromEnv = Number(process.env.LLM_CONTEXT_CHARS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  // Claude models take ~1M tokens; local models are usually configured far smaller.
  return provider() === "ollama" ? 24_000 : 400_000;
}

// On Vercel the OIDC token comes from the request context. Background work
// (after()) may run outside it, so remember the last token seen in a request.
let lastOidcToken: string | undefined;

async function gatewayKey(): Promise<string | undefined> {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  try {
    const token = await getVercelOidcToken();
    if (token) lastOidcToken = token;
  } catch {
    // Outside a request context: fall back to the remembered token.
  }
  return lastOidcToken ?? process.env.VERCEL_OIDC_TOKEN;
}

/** Call at the start of a request that will schedule background model calls. */
export async function primeCredentials(): Promise<void> {
  if (provider() === "gateway") await gatewayKey();
}

/** A Claude client for the configured provider (direct API or AI Gateway). */
export async function getClaudeClient(): Promise<{ client: Anthropic; model: (name?: string) => string }> {
  const p = provider();
  if (p === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) throw new LlmConfigError("لم يُضبط ANTHROPIC_API_KEY.");
    return {
      client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
      model: (name = CLAUDE_REVIEW_MODEL) => name,
    };
  }
  if (p === "gateway") {
    const apiKey = await gatewayKey();
    if (!apiKey) {
      throw new LlmConfigError(
        "تعذر الحصول على صلاحية Vercel AI Gateway. على Vercel يجب أن يكون OIDC مفعّلًا للمشروع، أو أضف AI_GATEWAY_API_KEY.",
      );
    }
    return {
      client: new Anthropic({ apiKey, baseURL: GATEWAY_URL }),
      model: (name = CLAUDE_REVIEW_MODEL) => claudeModelId(name),
    };
  }
  throw new LlmConfigError("هذه الميزة تتطلب Claude (anthropic أو gateway)، والمحرك الحالي هو Ollama.");
}

export async function generateStructured<T extends z.ZodType>(
  request: StructuredRequest<T>,
): Promise<z.infer<T>> {
  return provider() === "ollama" ? viaOllama(request) : viaClaude(request);
}

/** Translate SDK errors into messages a non-technical reviewer can act on. */
export function describeClaudeError(agent: string, error: unknown): Error {
  if (error instanceof LlmConfigError) return error;
  const gateway = provider() === "gateway";
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new Error(
      gateway
        ? `${agent}: رفضت Vercel AI Gateway الصلاحية. تأكد من تفعيل AI Gateway لحسابك.`
        : `${agent}: مفتاح ANTHROPIC_API_KEY غير صالح.`,
    );
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new Error(`${agent}: تجاوزت حد الطلبات المسموح. انتظر دقيقة ثم أعد المحاولة.`);
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError || error instanceof Anthropic.APIConnectionError) {
    return new Error(`${agent}: تعذر الاتصال بخدمة الذكاء الاصطناعي. تحقق من الشبكة ثم أعد المحاولة.`);
  }
  if (error instanceof Anthropic.APIError) {
    if (error.status === 402) {
      return new Error(`${agent}: رصيد Vercel AI Gateway غير كافٍ. أضف رصيدًا من لوحة Vercel أو استخدم مفتاحًا آخر.`);
    }
    if (error.status === 404) {
      return new Error(`${agent}: النموذج "${claudeModelId(CLAUDE_REVIEW_MODEL)}" غير متاح. غيّر CLAUDE_MODEL.`);
    }
    if (error.status && error.status >= 500) {
      return new Error(`${agent}: خدمة الذكاء الاصطناعي غير متاحة مؤقتًا (${error.status}). أعد المحاولة بعد قليل.`);
    }
    return new Error(`${agent}: خطأ من خدمة الذكاء الاصطناعي (${error.status ?? ""}): ${error.message}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

async function viaClaude<T extends z.ZodType>(request: StructuredRequest<T>): Promise<z.infer<T>> {
  const { client, model } = await getClaudeClient();
  const modelId = model();
  // Server-side refusal fallback: direct API only, newest tiers only.
  const useFallback = provider() === "anthropic" && /^claude-(opus-5|fable-5)/.test(modelId);

  let stopReason: string | null;
  let parsed: unknown;
  try {
    if (useFallback) {
      const response = await client.beta.messages.parse({
        model: modelId,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: request.effort ?? "high", format: betaZodOutputFormat(request.schema) },
        betas: ["server-side-fallback-2026-06-01"],
        fallbacks: [{ model: "claude-opus-4-8" }],
        system: request.system,
        messages: [{ role: "user", content: request.user }],
      });
      stopReason = response.stop_reason;
      parsed = response.parsed_output;
    } else {
      const response = await client.messages.parse({
        model: modelId,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: request.effort ?? "high", format: zodOutputFormat(request.schema) },
        system: request.system,
        messages: [{ role: "user", content: request.user }],
      });
      stopReason = response.stop_reason;
      parsed = response.parsed_output;
    }
  } catch (error) {
    throw describeClaudeError(request.agent, error);
  }

  if (stopReason === "refusal") {
    throw new Error(`${request.agent}: رفض النموذج معالجة هذا الطلب.`);
  }
  if (stopReason === "max_tokens") {
    throw new Error(`${request.agent}: انقطع رد النموذج لطوله. جرّب مستندًا أقصر أو قسّمه.`);
  }
  if (parsed == null) {
    throw new Error(`${request.agent}: لم يُرجع النموذج نتيجة قابلة للقراءة. أعد المحاولة.`);
  }
  return parsed as z.infer<T>;
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
    let res: Response;
    try {
      res = await fetch(`${OLLAMA_URL}/api/chat`, {
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
    } catch {
      throw new Error(
        `${request.agent}: تعذر الاتصال بـ Ollama على ${OLLAMA_URL}. تأكد أن Ollama يعمل (ollama serve).`,
      );
    }

    const body = (await res.json().catch(() => ({}))) as OllamaChatResponse;
    if (!res.ok) {
      if (res.status === 404 || /not found/i.test(body.error ?? "")) {
        throw new Error(`${request.agent}: النموذج ${OLLAMA_MODEL} غير مثبت. نفّذ: ollama pull ${OLLAMA_MODEL}`);
      }
      throw new Error(`${request.agent}: خطأ من Ollama (${res.status}) ${body.error ?? ""}`);
    }

    try {
      return request.schema.parse(JSON.parse(body.message?.content ?? ""));
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `${request.agent}: أرجع النموذج المحلي بيانات غير صالحة مرتين (${lastError instanceof Error ? lastError.message.slice(0, 120) : "unknown"}). جرّب نموذجًا أكبر.`,
  );
}

export interface LlmStatus {
  ok: boolean;
  provider: Provider | "invalid";
  engine: string;
  message: string;
}

/**
 * Fast readiness check (no model call is made): is the configured engine
 * usable? Used by the health endpoint and before accepting a new review.
 */
export async function checkLlm(): Promise<LlmStatus> {
  let p: Provider;
  try {
    p = provider();
  } catch (error) {
    return { ok: false, provider: "invalid", engine: "", message: (error as Error).message };
  }
  const engine = engineLabel();

  if (p === "anthropic") {
    return process.env.ANTHROPIC_API_KEY
      ? { ok: true, provider: p, engine, message: "Claude API جاهز." }
      : { ok: false, provider: p, engine, message: "لم يُضبط ANTHROPIC_API_KEY." };
  }

  if (p === "gateway") {
    const key = await gatewayKey();
    return key
      ? { ok: true, provider: p, engine, message: "Vercel AI Gateway جاهز." }
      : {
          ok: false,
          provider: p,
          engine,
          message: "لا توجد صلاحية لـ Vercel AI Gateway: فعّل OIDC للمشروع أو أضف AI_GATEWAY_API_KEY.",
        };
  }

  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { models?: { name: string; model?: string }[] };
    const names = (data.models ?? []).flatMap((m) => [m.name, m.model ?? ""]);
    const installed = names.some((n) => n === OLLAMA_MODEL || n === `${OLLAMA_MODEL}:latest`);
    return installed
      ? { ok: true, provider: p, engine, message: "Ollama جاهز." }
      : {
          ok: false,
          provider: p,
          engine,
          message: `Ollama يعمل لكن النموذج ${OLLAMA_MODEL} غير مثبت. نفّذ: ollama pull ${OLLAMA_MODEL}`,
        };
  } catch {
    return {
      ok: false,
      provider: p,
      engine,
      message: `تعذر الاتصال بـ Ollama على ${OLLAMA_URL}. شغّل Ollama، أو اضبط LLM_PROVIDER على محرك آخر.`,
    };
  }
}
