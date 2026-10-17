// One fetch helper for the external sources: identifying User-Agent (required
// by Wikimedia), a hard timeout, and Next's data cache so the same lookup is
// not repeated within a day.

export const USER_AGENT =
  "Harak/0.1 (+https://github.com/s141694-sketch/Curriculum-Reviewer)";

export class UpstreamError extends Error {
  constructor(
    readonly source: string,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

interface GetJsonOptions {
  /** Seconds to keep the response in Next's data cache (default: one day). */
  revalidate?: number;
  timeoutMs?: number;
}

export async function getJson<T>(
  source: string,
  url: string,
  { revalidate = 86_400, timeoutMs = 8_000 }: GetJsonOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate },
    });
  } catch (error) {
    throw new UpstreamError(source, error instanceof Error ? error.message : "network error");
  }
  if (!response.ok) {
    throw new UpstreamError(source, `HTTP ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}
