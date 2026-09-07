import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";

/**
 * Better Auth's HTTP surface, narrowed to what the browser needs. Sign-in, sign-out,
 * impersonation and user creation happen only through Server Actions, which write their
 * activity rows; the admin plugin's own endpoints (impersonate-user, create-user,
 * set-role, ban-user, …) would bypass the audit log, so they are not reachable over HTTP.
 * The instance is resolved per request so importing this route never reads secrets at
 * build time.
 */
const ALLOWED_GET = new Set(["/api/auth/get-session", "/api/auth/ok"]);

export const { GET } = toNextJsHandler((request: Request) =>
  ALLOWED_GET.has(new URL(request.url).pathname)
    ? getAuth().handler(request)
    : Promise.resolve(new Response(null, { status: 404 })),
);

export function POST(): Response {
  return new Response(null, { status: 404 });
}
