import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSessionCookie } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_PREFIXES = ["/api/cron", "/api/health", "/_next", "/favicon"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSessionCookie(token)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?from=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
