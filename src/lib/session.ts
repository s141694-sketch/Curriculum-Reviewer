// Signed session cookie: {name, role, at} + HMAC-SHA256. Web Crypto only, so
// it runs in the proxy as well as in route handlers.

export type Role = "member" | "reviewer" | "admin";

export interface Session {
  name: string;
  role: Role;
  at: string;
}

export const ROLES: Role[] = ["member", "reviewer", "admin"];

export const ROLE_LABELS: Record<Role, string> = {
  member: "مصمم مناهج",
  reviewer: "مراجع مناهج",
  admin: "مسؤول النظام",
};

export const SESSION_COOKIE = "harak_session";

export function isElevated(role: Role): boolean {
  return role === "reviewer" || role === "admin";
}

function secret(): string {
  return process.env.SESSION_SECRET || "harak-dev-secret-change-me";
}

const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function b64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): string {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(b + "=".repeat((4 - (b.length % 4)) % 4))));
}

export async function encodeSession(session: Session): Promise<string> {
  const payload = b64url(JSON.stringify(session));
  return `${payload}.${await hmac(payload)}`;
}

export async function decodeSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if ((await hmac(payload)) !== sig) return null;
  try {
    const parsed = JSON.parse(unb64url(payload)) as Session;
    if (typeof parsed.name !== "string" || !ROLES.includes(parsed.role)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** No passcodes: the role is chosen freely on the login screen. */
export function passcodeFor(): string {
  return "";
}
