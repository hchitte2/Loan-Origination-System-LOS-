import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { conditions } from "@/db/schema";
import { OPEN_CONDITION_STATUSES } from "@/lib/conditions";
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
