import { NextResponse, type NextRequest } from "next/server";
import { readSessionToken, roleHome, SESSION_COOKIE } from "@/lib/auth/token";

const PUBLIC_PREFIXES = [
  "/login",
  "/share",
  "/offline",
  "/api",
  "/demo",
  "/icons",
  "/manifest.webmanifest",
  "/sw.js",
  "/robots.txt",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? await readSessionToken(token) : null;

  if (pathname === "/login" && claims) {
    return NextResponse.redirect(new URL(roleHome(claims.role), request.url));
  }

  if (!claims && !isPublic(pathname)) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
