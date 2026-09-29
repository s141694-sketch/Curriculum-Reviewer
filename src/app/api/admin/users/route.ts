import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeSession, isElevated, SESSION_COOKIE } from "@/lib/session";
import { clearLogins, readLogins } from "@/lib/users";
import { aiConfig } from "@/lib/ai";

async function currentSession() {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
}

// Reviewers and admins: who logged in, plus the AI configuration in use.
export async function GET() {
  const session = await currentSession();
  if (!session || !isElevated(session.role)) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  return NextResponse.json({ logins: await readLogins(), ai: aiConfig() });
}

// Admins only: clear the login log.
export async function DELETE() {
  const session = await currentSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }
  await clearLogins();
  return NextResponse.json({ logins: [] });
}
