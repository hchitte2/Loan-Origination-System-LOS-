/**
 * The single entry point behind every `pnpm db:*` script (and `pnpm seed:files`).
 *
 *   tsx src/db/cli.ts <migrate|seed|reset|seed-files> [--env <file>]
 *
 * It loads `--env` (default `.env.local`; the `:prod` scripts pass `.env.production.local`),
 * then compares the `DATABASE_URL` host with `.claude/prod-db-host` and refuses to touch
 * production unless `CLEARLINE_RELEASE=1` is set, which only the /release procedure does.
 * The connection string itself is never printed.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { getEnv } from "@/lib/env";
import { isProductionHost, parseProdHostFile } from "./guard";
import { closeDb, db } from "./index";
import { type SeedSummary, seedFixture } from "./seed";

const COMMANDS = ["migrate", "seed", "reset", "seed-files"] as const;
type Command = (typeof COMMANDS)[number];

const PROD_HOST_FILE = path.join(".claude", "prod-db-host");
const MIGRATIONS_FOLDER = "drizzle";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function isCommand(value: string): value is Command {
  return (COMMANDS as readonly string[]).includes(value);
}

function parseArgs(argv: readonly string[]): {
  command: Command;
  envFile: string;
} {
  const [command, ...rest] = argv;
  if (!command || !isCommand(command)) {
    fail(`Usage: tsx src/db/cli.ts <${COMMANDS.join("|")}> [--env <file>]`);
  }
  let envFile = ".env.local";
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--env" && rest[i + 1]) {
      envFile = rest[i + 1];
      i += 1;
    } else {
      fail(`Unknown argument: ${rest[i]}`);
    }
  }
  return { command, envFile };
}

/** Hostname for log lines; the URL (which carries the password) is never printed. */
function displayHost(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return "(unparsable DATABASE_URL)";
  }
}

function readProdHosts(): string[] {
  if (!existsSync(PROD_HOST_FILE)) return [];
  return parseProdHostFile(readFileSync(PROD_HOST_FILE, "utf8"));
}

async function runMigrate(databaseUrl: string): Promise<void> {
  const journal = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json");
  if (!existsSync(journal)) {
    console.log(
      `No migrations in ${MIGRATIONS_FOLDER}/ yet; nothing to apply.`,
    );
    return;
  }
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: MIGRATIONS_FOLDER,
    });
    console.log("Migrations applied.");
  } finally {
    await pool.end();
  }
}

async function runSeed(mode: "seed" | "reset"): Promise<void> {
  // getEnv() validates the whole environment here, on purpose: the seed needs the demo
  // password and the showcase token, and a half-configured .env.local should fail loudly.
  const env = getEnv();
  const summary = await seedFixture(db(), {
    now: new Date(),
    demoPassword: env.DEMO_PASSWORD,
    showcaseToken: env.DEMO_SHOWCASE_TOKEN,
    mode,
  });
  printSummary(mode, summary);
  await closeDb();
}

function printSummary(mode: "seed" | "reset", s: SeedSummary): void {
  const byStage = Object.entries(s.loansByStage)
    .map(([stage, n]) => `${stage} ${n}`)
    .join(", ");
  console.log(
    [
      `${mode === "reset" ? "Reset" : "Seed"} complete.`,
      `  users      ${s.users}`,
      `  loans      ${s.loans} (${byStage})`,
      `  conditions ${s.conditions}`,
      `  documents  ${s.documents}`,
      `  activity   ${s.activity}`,
      "  showcase   /u/<DEMO_SHOWCASE_TOKEN>",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const { command, envFile } = parseArgs(process.argv.slice(2));
  // A missing file is fine: CI and Vercel provide the environment directly.
  loadDotenv({ path: envFile, quiet: true });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail(`DATABASE_URL is not set. Put it in ${envFile} (see .env.example).`);
  }

  const host = displayHost(databaseUrl);
  const production = isProductionHost(databaseUrl, readProdHosts());
  if (production && process.env.CLEARLINE_RELEASE !== "1") {
    fail(
      `Refusing to run "${command}" against the production database (${host}). ` +
        "Production is touched only through /release.",
    );
  }
  console.log(
    `db ${command} → ${host}${production ? " (production, release marker set)" : ""}`,
  );

  switch (command) {
    case "migrate":
      await runMigrate(databaseUrl);
      return;
    case "seed":
      await runSeed("seed");
      return;
    case "reset":
      getEnv(); // validate everything before touching the database
      await runMigrate(databaseUrl);
      await runSeed("reset");
      return;
    case "seed-files":
      fail('"seed-files" arrives with document storage in Phase 3.');
      break;
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
