import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

/**
 * The database layer's one job: prove the committed migrations apply from scratch and
 * that the `activity` table is append-only at the database, not just by convention.
 * pglite runs real Postgres in-process, so nothing here touches Neon.
 */

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

async function insertSystemRow(action: string): Promise<number> {
  const [row] = await db
    .insert(schema.activity)
    .values({ actorKind: "system", action, detail: {} })
    .returning({ id: schema.activity.id });
  return row.id;
}

/**
 * Drizzle wraps driver errors in a `DrizzleQueryError` whose message is the failed SQL;
 * the trigger's text is on `cause`. Raw pglite queries throw the Postgres error directly.
 */
async function expectAppendOnlyRefusal(
  promise: Promise<unknown>,
): Promise<void> {
  let thrown: unknown;
  try {
    await promise;
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  const error = thrown as Error;
  const messages = [
    error.message,
    error.cause instanceof Error ? error.cause.message : "",
  ];
  expect(messages.join("\n")).toMatch(/append-only/);
}

async function countRows(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.activity);
  return row.n;
}

describe("migrations", () => {
  it("create every table PLAN.md §6 names", async () => {
    const result = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
    );
    const names = result.rows.map((r) => r.table_name);
    for (const expected of [
      "user",
      "session",
      "account",
      "verification",
      "loans",
      "conditions",
      "documents",
      "activity",
    ]) {
      expect(names).toContain(expected);
    }
  });
});

describe("activity is append-only", () => {
  it("refuses UPDATE", async () => {
    const id = await insertSystemRow("demo.reset");
    await expectAppendOnlyRefusal(
      db
        .update(schema.activity)
        .set({ action: "tampered" })
        .where(sql`${schema.activity.id} = ${id}`),
    );
  });

  it("refuses DELETE", async () => {
    const id = await insertSystemRow("demo.reset");
    await expectAppendOnlyRefusal(
      db.delete(schema.activity).where(sql`${schema.activity.id} = ${id}`),
    );
  });

  it("refuses raw SQL too, not only the query builder", async () => {
    await insertSystemRow("demo.reset");
    await expectAppendOnlyRefusal(
      client.query("update activity set action = 'tampered'"),
    );
    await expectAppendOnlyRefusal(client.query("delete from activity"));
  });

  it("rolls an activity row back together with the change it records", async () => {
    const before = await countRows();
    await expect(
      db.transaction(async (tx) => {
        await tx
          .insert(schema.activity)
          .values({ actorKind: "system", action: "demo.reset", detail: {} });
        throw new Error("the write after the log failed");
      }),
    ).rejects.toThrow("the write after the log failed");
    expect(await countRows()).toBe(before);
  });
});
