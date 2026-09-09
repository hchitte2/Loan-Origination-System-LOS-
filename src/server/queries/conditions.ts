import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { conditions, loans } from "@/db/schema";
import { agingBuckets } from "@/lib/analytics-math";
import {
  type ConditionStatus,
  OPEN_CONDITION_STATUSES,
  type PriorTo,
} from "@/lib/conditions";
import { ACTIVE_STAGES } from "@/lib/stages";
import type { Actor } from "../actor";
import { assertCan } from "../authz";
import type { ConditionForGate } from "../transitions";

/**
 * Condition reads. `condition.read` is `any` for all three staff roles (PLAN.md §2), so
 * these queries authorize and then return every row for the loans asked for.
 *
 * Both take loan ids rather than resolving them, so the caller owes them ids the server
 * derived — `getLoanForAction`, or the result of `listPipelineLoans`. Never pass an id
 * that arrived from a client or a public token without loading the loan first.
 */

/**
 * The open conditions the stage machine needs to gate a move into clear-to-close or
 * funded, for many loans at once — the board builds a "Move to…" menu per card and must
 * not ask the database once per card. Cleared and waived rows gate nothing, so they are
 * left in the database.
 */
export async function listGateConditions(
  actor: Actor,
  loanIds: string[],
): Promise<Map<string, ConditionForGate[]>> {
  assertCan(actor, "condition.read");
  const byLoan = new Map<string, ConditionForGate[]>();
  if (loanIds.length === 0) return byLoan;
  const rows = await db()
    .select({
      loanId: conditions.loanId,
      status: conditions.status,
      priorTo: conditions.priorTo,
    })
    .from(conditions)
    .where(
      and(
        inArray(conditions.loanId, loanIds),
        inArray(conditions.status, [...OPEN_CONDITION_STATUSES]),
      ),
    );
  for (const row of rows) {
    const list = byLoan.get(row.loanId);
    const entry = { status: row.status, priorTo: row.priorTo };
    if (list) list.push(entry);
    else byLoan.set(row.loanId, [entry]);
  }
  return byLoan;
}

/** The same gate input for one loan, for the actions and the loan detail page. */
export async function getGateConditions(
  actor: Actor,
  loanId: string,
): Promise<ConditionForGate[]> {
  assertCan(actor, "condition.read");
  const rows = await db()
    .select({ status: conditions.status, priorTo: conditions.priorTo })
    .from(conditions)
    .where(
      and(
        eq(conditions.loanId, loanId),
        inArray(conditions.status, [...OPEN_CONDITION_STATUSES]),
      ),
    );
  return rows;
}

/** One row of the needs list (design frame 03-loan-detail). */
export type ConditionRow = {
  id: string;
  loanId: string;
  title: string;
  instructions: string | null;
  status: ConditionStatus;
  priorTo: PriorTo;
  borrowerFacing: boolean;
  lastRejectionReason: string | null;
  createdAt: Date;
  clearedAt: Date | null;
};

/**
 * A loan's whole needs list, soonest-due first: by prior-to bucket (the enum is declared
 * approval → docs → funding, which is the order they block), then oldest, then by title.
 *
 * The title is the tiebreak rather than the id because the default list is seeded in one
 * transaction and every row shares a `created_at` — ordering on the uuid would shuffle
 * the list on every reseed.
 */
export async function listConditions(
  actor: Actor,
  loanId: string,
): Promise<ConditionRow[]> {
  assertCan(actor, "condition.read");
  return db()
    .select({
      id: conditions.id,
      loanId: conditions.loanId,
      title: conditions.title,
      instructions: conditions.instructions,
      status: conditions.status,
      priorTo: conditions.priorTo,
      borrowerFacing: conditions.borrowerFacing,
      lastRejectionReason: conditions.lastRejectionReason,
      createdAt: conditions.createdAt,
      clearedAt: conditions.clearedAt,
    })
    .from(conditions)
    .where(eq(conditions.loanId, loanId))
    .orderBy(
      asc(conditions.priorTo),
      asc(conditions.createdAt),
      asc(conditions.title),
    );
}

/** One condition, for an action about to change it. Null means it is not on this loan. */
export async function getCondition(
  actor: Actor,
  loanId: string,
  conditionId: string,
): Promise<ConditionRow | null> {
  assertCan(actor, "condition.read");
  const [row] = await db()
    .select({
      id: conditions.id,
      loanId: conditions.loanId,
      title: conditions.title,
      instructions: conditions.instructions,
      status: conditions.status,
      priorTo: conditions.priorTo,
      borrowerFacing: conditions.borrowerFacing,
      lastRejectionReason: conditions.lastRejectionReason,
      createdAt: conditions.createdAt,
      clearedAt: conditions.clearedAt,
    })
    .from(conditions)
    // Scoped by loan as well as by id, so a condition id from one loan can never be
    // edited through another loan the actor does happen to own.
    .where(and(eq(conditions.id, conditionId), eq(conditions.loanId, loanId)))
    .limit(1);
  return row ?? null;
}

/** The numbers on the queue's tiles (design frame 04-queue). */
export type QueueCounts = {
  /** Open conditions across active files. */
  openConditions: number;
  /** Loans in Processing or later — the files actually being worked. */
  activeFiles: number;
  /** Open conditions by age, in the four drawn buckets. */
  aging: { label: string; count: number }[];
};

/**
 * Counts for the queue tiles. One pass over the open conditions on active loans, because
 * three of the four numbers come from the same rows and the fourth is a loan count.
 *
 * "Active files" is Processing or later, not every active stage: a lead with no documents
 * is not a file anyone is working.
 */
export async function getQueueCounts(
  actor: Actor,
  now: Date = new Date(),
): Promise<QueueCounts> {
  assertCan(actor, "condition.read");
  const worked = ACTIVE_STAGES.slice(ACTIVE_STAGES.indexOf("processing"));

  const [openRows, activeRows] = await Promise.all([
    db()
      .select({ createdAt: conditions.createdAt })
      .from(conditions)
      .innerJoin(loans, eq(loans.id, conditions.loanId))
      .where(
        and(
          inArray(conditions.status, [...OPEN_CONDITION_STATUSES]),
          inArray(loans.stage, [...ACTIVE_STAGES]),
        ),
      ),
    db()
      .select({ total: count() })
      .from(loans)
      .where(inArray(loans.stage, [...worked])),
  ]);

  return {
    aging: agingBuckets(
      openRows.map((row) => row.createdAt),
      now,
    ),
    openConditions: openRows.length,
    activeFiles: activeRows[0]?.total ?? 0,
  };
}
