import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";

/**
 * Better Auth's HTTP surface (sign-in, sign-out, session, admin plugin). The instance is
 * resolved per request so importing this route never reads secrets at build time.
 */
export const { GET, POST } = toNextJsHandler((request: Request) =>
  getAuth().handler(request),
);
