import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit is used for `generate` only (`pnpm db:generate`). Migrations are applied by
 * `src/db/cli.ts`, which guards against the production host; `drizzle-kit push` and
 * `drizzle-kit migrate` are never used.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
