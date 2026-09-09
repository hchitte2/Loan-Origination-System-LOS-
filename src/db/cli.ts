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
import { resetDemo } from "@/server/reset";
import { putSpecimen } from "@/server/storage";
import { isProductionHost, parseProdHostFile } from "./guard";
import { closeDb, db } from "./index";
import {
  type SeedSummary,
  SPECIMEN_SOURCE_DIR,
  SPECIMENS,
  seedFixture,
} from "./seed";

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

async function runSeed(): Promise<void> {
  // getEnv() validates the whole environment here, on purpose: the seed needs the demo
  // password and the showcase token, and a half-configured .env.local should fail loudly.
  const env = getEnv();
  const summary = await seedFixture(db(), {
    now: new Date(),
    demoPassword: env.DEMO_PASSWORD,
    showcaseToken: env.DEMO_SHOWCASE_TOKEN,
    mode: "seed",
  });
  printSummary("seed", summary);
  await closeDb();
}

/**
 * Upload the three specimen PDFs to `seed/` in Blob. Re-runnable: each goes to a fixed
 * pathname and overwrites, so running it twice leaves three objects, not six.
 *
 * The size the fixture quotes is what the needs list prints, so it has to be what the
 * download sends. A mismatch means the PDFs were rebuilt without updating `SPECIMENS`,
 * and this refuses rather than seeding a size no file has.
 */
async function runSeedFiles(): Promise<void> {
  getEnv(); // BLOB_READ_WRITE_TOKEN, before anything is read from disk
  const mismatches: string[] = [];
  const files = Object.values(SPECIMENS).map((specimen) => {
    const source = path.join(
      SPECIMEN_SOURCE_DIR,
      path.basename(specimen.pathname),
    );
    if (!existsSync(source)) {
      fail(
        `Missing ${source}. Rebuild it with: npx tsx src/db/specimens/build.ts`,
      );
    }
    const body = readFileSync(source);
    if (body.byteLength !== specimen.sizeBytes) {
      mismatches.push(
        `  ${specimen.pathname}: file is ${body.byteLength} B, SPECIMENS says ${specimen.sizeBytes} B`,
      );
    }
    return { pathname: specimen.pathname, body };
  });

  if (mismatches.length > 0) {
    fail(
      [
        "The specimen PDFs and the sizes in src/db/seed.ts disagree:",
        ...mismatches,
        "Update SPECIMENS to the real byte counts, then run this again.",
      ].join("\n"),
    );
  }

  for (const file of files) {
    await putSpecimen(file.pathname, file.body, "application/pdf");
    console.log(`  uploaded ${file.pathname} (${file.body.byteLength} B)`);
  }
  console.log(`Specimens uploaded: ${files.length}.`);
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
      await runSeed();
      return;
    case "reset": {
      getEnv(); // validate everything before touching the database
      await runMigrate(databaseUrl);
      // The order — blobs, then truncate and reseed — lives in `resetDemo`, which the
      // cron route and the superadmin button call too, so all three agree.
      const summary = await resetDemo();
      console.log(`  removed ${summary.blobsDeleted} uploaded file(s)`);
      printSummary("reset", summary);
      await closeDb();
      return;
    }
    case "seed-files":
      await runSeedFiles();
      return;
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
