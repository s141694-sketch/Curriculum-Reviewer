import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { checkLlm, engineLabel, LlmConfigError, provider } from "@/lib/server/llm";
import { isActive } from "@/lib/server/pipeline";
import { storageBackend } from "@/lib/server/store";

const KEYS = ["LLM_PROVIDER", "ANTHROPIC_API_KEY", "AI_GATEWAY_API_KEY", "VERCEL", "BLOB_READ_WRITE_TOKEN", "STORAGE_BACKEND"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function env(values: Record<string, string | undefined>) {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, values);
}

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("provider selection", () => {
  it("defaults to the local model when nothing is configured", () => {
    env({});
    assert.equal(provider(), "ollama");
  });

  it("uses Claude directly when an Anthropic key is present", () => {
    env({ ANTHROPIC_API_KEY: "x", VERCEL: "1" });
    assert.equal(provider(), "anthropic");
  });

  it("uses AI Gateway on Vercel without a key, with gateway model ids", () => {
    env({ VERCEL: "1" });
    assert.equal(provider(), "gateway");
    assert.match(engineLabel(), /^gateway:anthropic\/claude-/);
  });

  it("honours an explicit provider and rejects unknown ones", () => {
    env({ LLM_PROVIDER: "ollama", VERCEL: "1", ANTHROPIC_API_KEY: "x" });
    assert.equal(provider(), "ollama");
    env({ LLM_PROVIDER: "gpt" });
    assert.throws(() => provider(), LlmConfigError);
  });
});

describe("storage backend selection", () => {
  it("uses Blob when a token is present, local files otherwise", () => {
    env({});
    assert.equal(storageBackend(), "fs");
    env({ BLOB_READ_WRITE_TOKEN: "t" });
    assert.equal(storageBackend(), "blob");
    env({ BLOB_READ_WRITE_TOKEN: "t", STORAGE_BACKEND: "fs" });
    assert.equal(storageBackend(), "fs");
  });
});

describe("isActive", () => {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

  it("self-hosted: a running review not owned by this process is interrupted", () => {
    env({});
    assert.equal(isActive({ id: "a", status: "running", updatedAt: minutesAgo(0) }), false);
  });

  it("on Vercel: judged by how recently the review was updated", () => {
    env({ VERCEL: "1" });
    assert.equal(isActive({ id: "a", status: "running", updatedAt: minutesAgo(1) }), true);
    assert.equal(isActive({ id: "a", status: "queued", updatedAt: minutesAgo(1) }), true);
    assert.equal(isActive({ id: "a", status: "running", updatedAt: minutesAgo(10) }), false);
    assert.equal(isActive({ id: "a", status: "done", updatedAt: minutesAgo(0) }), false);
  });
});

describe("gateway readiness check", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function gatewayAnswers(status: number, body: unknown) {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  }

  it("reports not ready when the gateway rejects the credentials", async () => {
    env({ VERCEL: "1", AI_GATEWAY_API_KEY: "rejected-key" });
    gatewayAnswers(403, { error: "forbidden" });
    const status = await checkLlm();
    assert.equal(status.ok, false);
    assert.match(status.message, /403/);
  });

  it("reports not ready with a zero balance, ready with credit", async () => {
    env({ VERCEL: "1", AI_GATEWAY_API_KEY: "empty-key" });
    gatewayAnswers(200, { balance: "0.00", total_used: "0" });
    assert.equal((await checkLlm()).ok, false);

    env({ VERCEL: "1", AI_GATEWAY_API_KEY: "funded-key" });
    gatewayAnswers(200, { balance: "5.00", total_used: "0" });
    const ready = await checkLlm();
    assert.equal(ready.ok, true);
    assert.match(ready.message, /5\.00/);
  });
});
