import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  DEMO_USERS,
  FIXTURE_LOAN_COUNT,
  type SeedSummary,
  seedFixture,
} from "@/db/seed";

/**
 * The seed is the reset routine, so it must be deterministic and idempotent: two runs
 * leave the same rows, and a visitor-created user disappears. pglite keeps this off Neon.
 */

const NOW = new Date("2026-09-06T15:00:00.000Z");
const options = {
  now: NOW,
  demoPassword: "demo-password-for-tests",
  showcaseToken: "0123456789abcdef0123456789abcdef",
} as const;

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

beforeAll(async () => {
  client = new PGlite();
  db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "drizzle" });
});

afterAll(async () => {
  await client.close();
});

async function count(table: string): Promise<number> {
  const result = await client.query<{ n: number }>(
    `select count(*)::int as n from "${table}"`,
  );
  return result.rows[0].n;
}

describe("seedFixture", () => {
  let first: SeedSummary;

  it("builds the fixture PLAN.md §6 describes", async () => {
    first = await seedFixture(db, { ...options, mode: "seed" });
    expect(first.users).toBe(DEMO_USERS.length);
    expect(first.loans).toBe(FIXTURE_LOAN_COUNT);
    expect(first.loansByStage).toMatchObject({
      lead: 3,
      application: 2,
      processing: 3,
      conditional_approval: 3,
      clear_to_close: 2,
      funded: 9,
      withdrawn: 2,
      denied: 1,
    });
    expect(first.loansByStage.underwriting).toBeUndefined();
    expect(await count("activity")).toBe(first.activity);

    const showcase = await db
      .select({ token: schema.loans.uploadToken, stage: schema.loans.stage })
      .from(schema.loans)
      .where(sql`${schema.loans.borrowerName} = 'Maria Chen'`);
    expect(showcase).toEqual([
      { token: options.showcaseToken, stage: "processing" },
    ]);
  });

  it("gives every seeded user a credential account with a password hash", async () => {
    const accounts = await db
      .select({
        providerId: schema.account.providerId,
        hasPassword: sql<boolean>`${schema.account.password} is not null`,
      })
      .from(schema.account);
    expect(accounts).toHaveLength(DEMO_USERS.length);
    for (const a of accounts) {
      expect(a.providerId).toBe("credential");
      expect(a.hasPassword).toBe(true);
    }
  });

  it("is idempotent and removes users a visitor created", async () => {
    await db.insert(schema.user).values({
      id: "usr_visitor_made",
      name: "Visitor Made",
      email: "visitor.made@example.com",
      role: "processor",
    });
    const second = await seedFixture(db, { ...options, mode: "reset" });
    expect(second).toEqual({ ...first, activity: first.activity + 1 });
    expect(await count("user")).toBe(DEMO_USERS.length);
    expect(await count("loans")).toBe(first.loans);
    expect(await count("conditions")).toBe(first.conditions);
    expect(await count("documents")).toBe(first.documents);
    const resets = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.activity)
      .where(sql`${schema.activity.action} = 'demo.reset'`);
    expect(resets[0].n).toBe(1);
  });

  it("keeps the audit log honest: no row with an actor kind that contradicts its actor", async () => {
    const bad = await client.query<{ n: number }>(
      `select count(*)::int as n from activity where (actor_kind = 'user') <> (actor_id is not null)`,
    );
    expect(bad.rows[0].n).toBe(0);
  });
});
