import { z } from "zod";

/**
 * Server-side environment, validated once per process.
 *
 * Call `getEnv()` at use time, never at module top level: `next build` pre-renders
 * pages and evaluates their imports, and unit tests import pure modules, so a module
 * must not demand secrets just for being imported. Only code that talks to a
 * subsystem (database, auth, storage, cron) reads the environment.
 *
 * No secret is ever `NEXT_PUBLIC_`.
 */
export const envSchema = z.object({
  /** Neon Postgres. `dev` branch locally, `main` in production. */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  BETTER_AUTH_SECRET: z.string().min(32),
  /**
   * Public origin of the app. Required in production (the Vercel alias, so sign-in
   * origins match); optional elsewhere, where it falls back to the Vercel deployment
   * URL or localhost. See `src/server/auth.ts`.
   */
  BETTER_AUTH_URL: z.url().optional(),
  /** Private Vercel Blob store. */
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  /** Bearer token the Vercel cron sends to /api/cron/reset. */
  CRON_SECRET: z.string().min(16),
  /** Password shared by every seeded demo account. */
  DEMO_PASSWORD: z.string().min(8),
  /** Stable upload token for the showcase loan, so the login page can link to it. */
  DEMO_SHOWCASE_TOKEN: z.string().min(16),
  /** Set by Vercel at build and run time; selects the serverless database driver. */
  VERCEL: z.string().optional(),
  /** Vercel deployment hostnames (no scheme); trusted as sign-in origins on previews. */
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse an environment-shaped record. Throws an error that names the offending keys
 * and the rule they broke, never the values.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment. Fix these variables (see .env.example):\n${problems}`,
  );
}

let cached: Env | undefined;

/** The validated process environment, parsed on first use and cached. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
