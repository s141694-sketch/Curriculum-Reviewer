import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  decodeSession,
  encodeSession,
  passcodeFor,
  ROLES,
  SESSION_COOKIE,
  type Role,
  type Session,
} from "@/lib/session";
import { appendLogin } from "@/lib/users";

export async function GET() {
  const session = await decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  return NextResponse.json({ session });
}

export async function POST(request: NextRequest) {
  let body: { name?: string; role?: Role; passcode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const name = (body.name || "").trim().slice(0, 60);
  const role = body.role;
  if (name.length < 2) return NextResponse.json({ error: "اكتب اسمك (حرفان على الأقل)" }, { status: 400 });
  if (!role || !ROLES.includes(role)) return NextResponse.json({ error: "اختر دورًا" }, { status: 400 });

  const expected = passcodeFor(role);
  if (expected && body.passcode !== expected) {
    return NextResponse.json({ error: "رمز الدخول غير صحيح" }, { status: 401 });
  }

  const session: Session = { name, role, at: new Date().toISOString() };
  await appendLogin(session);

  const response = NextResponse.json({ session });
  response.cookies.set(SESSION_COOKIE, await encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ session: null });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
