import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { documents, loans, user } from "@/db/schema";
import { countLoansCreatedToday, countUploadsToday } from "@/server/limits";

/**
 * The cap decision is unit-tested; what needs a database is the count itself — that the
 * UTC-day boundary really lands where `loanCapReached` assumes, in SQL rather than in
 * JavaScript. pglite keeps this off Neon.
 */

const NOW = new Date("2026-09-08T15:00:00.000Z");
const MIDNIGHT = new Date("2026-09-08T00:00:00.000Z");
const OFFICER = "user_officer_limits";

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

/** One loan whose `created_at` is exactly `createdAt`, with the columns the table needs. */
function loanAt(createdAt: Date, token: string) {
  return {
    borrowerName: "Dana Example",
    borrowerEmail: "dana@example.com",
    propertyStreet: "1 Fictional Way",
    propertyCity: "Austin",
    propertyState: "TX",
    propertyZip: "78701",
    purpose: "purchase" as const,
    loanType: "conventional" as const,
    amount: 300_000,
    loanOfficerId: OFFICER,
    referralSource: "online" as const,
    uploadToken: token,
    createdAt,
  };
}

/** One document row on `loanId`, created at `createdAt`. */
function docAt(loanId: string, createdAt: Date, key: string) {
  return {
    loanId,
    uploadedVia: "public_link" as const,
    fileName: `${key}.pdf`,
    blobPathname: `uploads/${loanId}/${key}.pdf`,
    contentType: "application/pdf",
    sizeBytes: 1024,
    createdAt,
  };
}

beforeAll(async () => {
  client = new PGlite();
  db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(user).values({
    id: OFFICER,
    name: "Officer Example",
    email: "officer@example.com",
    emailVerified: true,
    role: "loan_officer",
  });
});

describe("countLoansCreatedToday", () => {
  it("counts nothing on an empty day", async () => {
    expect(await countLoansCreatedToday(NOW, db)).toBe(0);
  });

  it("counts a loan created earlier the same UTC day", async () => {
    await db
      .insert(loans)
      .values(loanAt(new Date("2026-09-08T09:12:00.000Z"), "t".repeat(32)));
    expect(await countLoansCreatedToday(NOW, db)).toBe(1);
  });

  it("counts a loan created exactly at midnight UTC", async () => {
    // The window is inclusive of its left edge, so this loan belongs to today.
    await db.insert(loans).values(loanAt(MIDNIGHT, "m".repeat(32)));
    expect(await countLoansCreatedToday(NOW, db)).toBe(2);
  });

  it("ignores a loan created a millisecond before midnight UTC", async () => {
    await db
      .insert(loans)
      .values(loanAt(new Date("2026-09-07T23:59:59.999Z"), "y".repeat(32)));
    expect(await countLoansCreatedToday(NOW, db)).toBe(2);
  });

  it("ignores loans from days before", async () => {
    await db
      .insert(loans)
      .values(loanAt(new Date("2026-08-30T12:00:00.000Z"), "o".repeat(32)));
    expect(await countLoansCreatedToday(NOW, db)).toBe(2);
  });

  it("counts every actor's loans, not only one officer's", async () => {
    await db.insert(user).values({
      id: "user_other_limits",
      name: "Other Example",
      email: "other@example.com",
      emailVerified: true,
      role: "loan_officer",
    });
    await db.insert(loans).values({
      ...loanAt(new Date("2026-09-08T11:00:00.000Z"), "z".repeat(32)),
      loanOfficerId: "user_other_limits",
    });
    expect(await countLoansCreatedToday(NOW, db)).toBe(3);
  });

  it("moves the window with the day it is asked about", async () => {
    const tomorrow = new Date("2026-09-09T08:00:00.000Z");
    expect(await countLoansCreatedToday(tomorrow, db)).toBe(0);
  });
});

describe("countUploadsToday", () => {
  // A second loan, so the per-loan count and the day count can disagree.
  const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
  const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

  beforeAll(async () => {
    await db.insert(loans).values([
      {
        ...loanAt(new Date("2026-09-01T10:00:00.000Z"), "A".repeat(32)),
        id: A,
      },
      {
        ...loanAt(new Date("2026-09-01T10:00:00.000Z"), "B".repeat(32)),
        id: B,
      },
    ]);
    await db.insert(documents).values([
      docAt(A, new Date("2026-09-08T08:00:00.000Z"), "a1"),
      docAt(A, new Date("2026-09-08T09:00:00.000Z"), "a2"),
      docAt(B, new Date("2026-09-08T09:30:00.000Z"), "b1"),
      // Yesterday: outside the window, for both counts.
      docAt(A, new Date("2026-09-07T23:59:59.999Z"), "a-yesterday"),
      docAt(B, new Date("2026-09-07T12:00:00.000Z"), "b-yesterday"),
    ]);
  });

  it("counts this loan's uploads and the whole day's in one answer", async () => {
    expect(await countUploadsToday(A, NOW, db)).toEqual({
      forLoan: 2,
      forDay: 3,
    });
  });

  it("scopes forLoan to the loan asked about", async () => {
    expect(await countUploadsToday(B, NOW, db)).toEqual({
      forLoan: 1,
      forDay: 3,
    });
  });

  it("returns zero for a loan with nothing today, while the day still counts", async () => {
    const untouched = "cccccccc-3333-4333-8333-cccccccccccc";
    expect(await countUploadsToday(untouched, NOW, db)).toEqual({
      forLoan: 0,
      forDay: 3,
    });
  });

  it("takes midnight UTC as the left edge, like the loan cap", async () => {
    // One document exactly on the boundary counts; the one before it does not. The
    // window has no right edge on purpose — the app only ever asks about now.
    await db
      .insert(documents)
      .values(docAt(A, new Date("2026-09-08T00:00:00.000Z"), "a-midnight"));
    expect(await countUploadsToday(A, NOW, db)).toEqual({
      forLoan: 3,
      forDay: 4,
    });
  });
});
