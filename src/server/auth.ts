import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { createAccessControl } from "better-auth/plugins/access";
import { admin } from "better-auth/plugins/admin";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getEnv } from "@/lib/env";
import type { Role } from "@/lib/roles";

/**
 * Better Auth configuration (PLAN.md §5 "Authorization and impersonation").
 *
 * Email + password sessions under the hood (nobody types a password; the login cards
 * sign in with `DEMO_PASSWORD`). The admin plugin provides impersonation: a superadmin
 * "views as" another user for up to four hours, the session carries `impersonatedBy`,
 * and superadmins cannot impersonate other superadmins (plugin default). `nextCookies()`
 * is last so Server Actions can set the session cookie.
 *
 * Created lazily: `getAuth()` reads the environment and opens the database on first use,
 * never at import, so `next build` and unit tests import this module without secrets.
 */

/** Four hours, in seconds. */
const IMPERSONATION_SESSION_SECONDS = 4 * 60 * 60;

const ac = createAccessControl(defaultStatements);

/**
 * Better Auth roles mirror `user.role`. Only the superadmin holds admin-plugin
 * permissions (create users, list, impersonate). The other two hold none: Clearline's
 * own policy table in `authz.ts` decides what they may do with loans.
 */
const roles = {
  superadmin: ac.newRole({ ...adminAc.statements }),
  loan_officer: ac.newRole({ user: [], session: [] }),
  processor: ac.newRole({ user: [], session: [] }),
} satisfies Record<Role, unknown>;

function originOf(hostname: string | undefined): string | undefined {
  return hostname ? `https://${hostname}` : undefined;
}

function createAuth() {
  const env = getEnv();
  const baseURL =
    env.BETTER_AUTH_URL ?? originOf(env.VERCEL_URL) ?? "http://localhost:3000";
  const trustedOrigins = [
    baseURL,
    originOf(env.VERCEL_URL),
    originOf(env.VERCEL_BRANCH_URL),
    originOf(env.VERCEL_PROJECT_PRODUCTION_URL),
  ].filter((origin): origin is string => origin !== undefined);

  return betterAuth({
    appName: "Clearline",
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,
    database: drizzleAdapter(db(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      // Demo accounts are seeded; nobody self-registers or resets a password.
      disableSignUp: true,
    },
    user: {
      additionalFields: {
        nmlsId: { type: "string", required: false, input: false },
        phone: { type: "string", required: false, input: false },
      },
    },
    advanced: {
      // A public demo stores nothing about its visitors beyond the session token.
      ipAddress: { disableIpTracking: true },
    },
    plugins: [
      admin({
        ac,
        roles,
        adminRoles: ["superadmin"],
        defaultRole: "loan_officer",
        impersonationSessionDuration: IMPERSONATION_SESSION_SECONDS,
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/** The Better Auth instance, created on first use. */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}

/** What `getAuth().api.getSession()` resolves to when a session exists. */
export type AuthSession = NonNullable<
  Awaited<ReturnType<Auth["api"]["getSession"]>>
>;
