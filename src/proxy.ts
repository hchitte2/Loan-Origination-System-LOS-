import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic redirect only (PLAN.md §5): a staff route with no session cookie goes to
 * /login. This never reads the database and is never the control; every layout, page,
 * route handler and Server Action re-checks with `requireActor()` and `can()`.
 */

const STAFF_PREFIXES = [
  "/dashboard",
  "/pipeline",
  "/loans",
  "/queue",
  "/admin",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isStaffRoute = STAFF_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isStaffRoute && !getSessionCookie(request)) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pipeline/:path*",
    "/loans/:path*",
    "/queue/:path*",
    "/admin/:path*",
  ],
};
