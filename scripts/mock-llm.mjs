/*
 * Fake Ollama-compatible server for testing the pipeline plumbing WITHOUT a GPU.
 * Its answers are canned or naive heuristics - use it to check that the
 * automation runs end to end, never to measure quality.
 *
 *   node scripts/mock-llm.mjs            # listens on http://127.0.0.1:11555
 *   LLM_PROVIDER=ollama OLLAMA_URL=http://127.0.0.1:11555 npm run agents -- review sample.docx
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT) || 11555;

function answer(system, user) {
  if (system.includes("ingestion agent")) {
    return {
      subject: "Mock subject",
      gradeLevel: "unspecified",
      language: /[؀-ۿ]/.test(user) ? "Arabic" : "English",
      summary: "Mock summary produced by scripts/mock-llm.mjs.",
      learningObjectives: [],
      unitTitles: [],
    };
  }
  if (system.includes("language-quality agent")) {
    // Naive heuristic: an Arabic word ending in ه after the article is probably a missing ة.
    const issues = [];
    for (const section of user.matchAll(/<section index="(\d+)"[^>]*>([\s\S]*?)<\/section>/g)) {
      for (const match of section[2].matchAll(/(?<![؀-ۿ])([؀-ۿ]*ال[؀-ۿ]{2,}ه)(?![؀-ۿ])/g)) {
        issues.push({
          sectionIndex: Number(section[1]),
          type: "spelling",
          original: match[1],
          suggestion: match[1].slice(0, -1) + "ة",
          explanation: "mock: taa marbuta",
          severity: "medium",
        });
      }
    }
    return { issues };
  }
  if (system.includes("standards-alignment agent")) {
    const block = user.match(/<standards>\n([\s\S]*?)\n<\/standards>/)?.[1] ?? "";
    const codes = block.split("\n").map((line) => line.split(":")[0].trim()).filter(Boolean);
    return {
      results: codes.map((code, i) => ({
        code,
        status: ["met", "partial", "not_met"][i % 3],
        evidence: [],
        gap: i % 3 ? "mock gap" : "",
        recommendation: i % 3 ? "mock recommendation" : "",
      })),
    };
  }
  if (system.includes("content-analysis agent")) {
    const keys = [...system.matchAll(/^- (\w+): /gm)].map((m) => m[1]).filter((k) => k !== "bloomCounts");
    return {
      dimensions: keys.slice(0, 8).map((key, i) => ({ key, score: 55 + i * 5, findings: [`mock finding (${key})`], recommendations: [`mock recommendation (${key})`] })),
      bloomCounts: { remember: 4, understand: 3, apply: 2, analyze: 1, evaluate: 1, create: 0 },
      accuracyConcerns: [],
      strengths: ["mock strength"],
    };
  }
  if (system.includes("reporting agent")) {
    return {
      executiveSummary: "Mock executive summary.",
      keyFindings: ["mock finding"],
      recommendations: [{ priority: "high", area: "mock", action: "mock action" }],
    };
  }
  return {};
}

http
  .createServer(async (req, res) => {
    // Model list used by the app's health check: pretend the configured models are installed.
    if (req.method === "GET" && req.url === "/api/tags") {
      const names = ["mock", "qwen2.5:14b", "qwen2.5:7b", ...(process.env.MOCK_MODELS ?? "").split(",").filter(Boolean)];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ models: names.map((name) => ({ name, model: name })) }));
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const { messages = [] } = JSON.parse(body || "{}");
    const out = answer(messages[0]?.content ?? "", messages[1]?.content ?? "");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: { content: JSON.stringify(out) } }));
  })
  .listen(PORT, "127.0.0.1", () => console.log(`mock LLM on http://127.0.0.1:${PORT}`));
