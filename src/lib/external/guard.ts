import { cookies } from "next/headers";
import { decodeSession, SESSION_COOKIE, type Session } from "@/lib/session";

// The enrich routes call third-party APIs on the server's behalf, so they are
// only open to signed-in users (any role), not as an open proxy.
export async function signedInSession(): Promise<Session | null> {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Validated search text: trimmed, 2–200 characters, or null. */
export function cleanQuery(raw: string | null): string | null {
  const query = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  return query.length >= 2 ? query : null;
}
