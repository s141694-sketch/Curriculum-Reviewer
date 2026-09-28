import { NextResponse, type NextRequest } from "next/server";

// Optional HTTP Basic authentication for the whole app. Enabled when both
// APP_USERNAME and APP_PASSWORD are set. Intended as a minimal gate for an
// internal-network deployment; put the app behind your organisation's SSO or
// a TLS-terminating reverse proxy for anything stronger.

function safeEqual(a: string, b: string): boolean {
  // Constant-time comparison to avoid leaking the credential length/prefix via timing.
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function proxy(request: NextRequest) {
  const username = process.env.APP_USERNAME;
  const password = process.env.APP_PASSWORD;
  if (!username || !password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = new TextDecoder().decode(
        Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0)),
      );
      const separator = decoded.indexOf(":");
      const user = decoded.slice(0, separator);
      const pass = decoded.slice(separator + 1);
      if (separator > -1 && safeEqual(user, username) && safeEqual(pass, password)) {
        return NextResponse.next();
      }
    } catch {
      // Fall through to the challenge below.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Curriculum Reviewer", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
