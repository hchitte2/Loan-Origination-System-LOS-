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

  it("keeps a document's history after the document itself is deleted", async () => {
    // `deleteDocumentAction` removes the row rather than flagging it, which is the one
    // place this codebase destroys a record — so the whole feature rests on `activity`
    // having no foreign key to `documents`. Add one and the upload's own row would
    // cascade away, quietly turning an append-only log into an erasable one.
    const [officer] = await db
      .insert(schema.user)
      .values({
        id: "officer-history",
        name: "Alex Rivera",
        email: "alex.history@example.com",
        emailVerified: true,
        role: "loan_officer",
      })
      .returning({ id: schema.user.id });
    const [loan] = await db
      .insert(schema.loans)
      .values({
        borrowerName: "Casey Nolan",
        borrowerEmail: "casey.nolan@example.com",
        propertyStreet: "3 Quarry Rd",
        propertyCity: "Austin",
        propertyState: "TX",
        propertyZip: "78704",
        purpose: "purchase" as const,
        loanType: "conventional" as const,
        amount: 485_000,
        referralSource: "online" as const,
        loanOfficerId: officer.id,
        uploadToken: "history-token-000000000000",
      })
      .returning({ id: schema.loans.id });
    const [document] = await db
      .insert(schema.documents)
      .values({
        loanId: loan.id,
        uploadedBy: officer.id,
        uploadedVia: "staff",
        fileName: "wrong-file.pdf",
        blobPathname: `uploads/${loan.id}/wrong-file.pdf`,
        contentType: "application/pdf",
        sizeBytes: 42,
      })
      .returning({ id: schema.documents.id });

    await db.insert(schema.activity).values({
      loanId: loan.id,
      actorId: officer.id,
      actorKind: "user",
      action: "document.uploaded",
      detail: { documentId: document.id, fileName: "wrong-file.pdf" },
    });
    const before = await countRows();

    await db
      .delete(schema.documents)
      .where(sql`${schema.documents.id} = ${document.id}`);

    // The document is gone; what it did is not.
    expect(await countRows()).toBe(before);
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
