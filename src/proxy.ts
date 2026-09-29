import { NextResponse, type NextRequest } from "next/server";
import { decodeSession, isElevated, SESSION_COOKIE } from "@/lib/session";

// Every page needs a signed session; /admin additionally needs an elevated
// role. API routes check the cookie themselves.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  if (pathname.startsWith("/admin") && !isElevated(session.role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|icon\\.svg|favicon\\.ico).*)"],
};
