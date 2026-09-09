import { count, gte, sql } from "drizzle-orm";
import { type Db, db } from "@/db";
import { documents, loans } from "@/db/schema";

/**
 * Abuse caps for a demo whose write surfaces face the open internet (PLAN.md §5).
 *
 * Every cap is counted from rows that already exist — there is no counters table and no
 * per-IP tracking — so a cap costs one aggregate query and survives the nightly reset
 * without extra bookkeeping. The window is the UTC day: a fixed boundary everyone can
 * reason about, rather than a rolling window that would need a timestamp per actor.
 *
 * The decisions are pure functions over a count so `tests/unit/limits.test.ts` can walk
 * the boundary without a database; the queries beside them only supply the number.
 */

/** New loans per day, all actors together. `createLoan` enforces it. */
export const DAILY_LOAN_CAP = 30;

/** Uploads one loan may receive per UTC day, whoever sends them. */
export const PER_LOAN_UPLOAD_CAP = 10;

/** Uploads the whole demo may receive per UTC day. */
export const DAILY_UPLOAD_CAP = 40;

/**
 * What a visitor sees when a cap is reached. Not an error: the demo is intact, it has
 * simply had enough for today, and tomorrow it works again.
 */
export const CAP_REACHED = "Demo limit reached, try again tomorrow";

/** Midnight UTC of the day `now` falls in — the left edge of every cap window. */
export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * Is one more loan allowed, given how many exist since midnight UTC? The cap is the
 * number of loans a day may hold, so the 30th is allowed and the 31st is not.
 */
export function loanCapReached(createdToday: number): boolean {
  return createdToday >= DAILY_LOAN_CAP;
}

/** Is one more upload allowed — for this loan, and for the demo as a whole? */
export function uploadCapReached(counts: {
  forLoan: number;
  forDay: number;
}): boolean {
  return (
    counts.forLoan >= PER_LOAN_UPLOAD_CAP || counts.forDay >= DAILY_UPLOAD_CAP
  );
}

/**
 * Documents registered since midnight UTC: for one loan, and across the demo. Both come
 * from one round trip, because every upload has to ask about both.
 */
export async function countUploadsToday(
  loanId: string,
  now?: Date,
  database: Db = db(),
): Promise<{ forLoan: number; forDay: number }> {
  const [row] = await database
    .select({
      forLoan: count(sql`case when ${documents.loanId} = ${loanId} then 1 end`),
      forDay: count(),
    })
    .from(documents)
    .where(gte(documents.createdAt, startOfUtcDay(now)));
  return { forLoan: row?.forLoan ?? 0, forDay: row?.forDay ?? 0 };
}

/**
 * Loans created since midnight UTC, across every actor. `database` is injectable so
 * `tests/db/limits.test.ts` can run the real SQL against pglite; the app never passes it.
 */
export async function countLoansCreatedToday(
  now?: Date,
  database: Db = db(),
): Promise<number> {
  const [row] = await database
    .select({ created: count() })
    .from(loans)
    .where(gte(loans.createdAt, startOfUtcDay(now)));
  return row?.created ?? 0;
}
