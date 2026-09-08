"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { loans } from "@/db/schema";
import type { Stage } from "@/lib/stages";
import { logActivity } from "../activity";
import { requireActor } from "../actor";
import { getGateConditions } from "../queries/conditions";
import { getLoanForAction } from "../queries/loans";
import { move } from "../transitions";
import { MoveLoanSchema } from "./schemas";

/**
 * Loan mutations (PLAN.md §2 rows `loan.move_early` and `loan.move_late`). Thin by
 * design: parse, load, authorize through the stage machine, write the patch and the one
 * activity row in a single transaction, revalidate.
 *
 * `transitions.ts` is the only thing that decides a move and the only thing that produces
 * the patch, so no action ever assigns `loans.stage` itself. It also runs the permission
 * check, because which matrix row applies depends on the two stages involved.
 */

/** The loan left the stage this move was decided from before the write landed. */
class StaleLoanError extends Error {
  constructor() {
    super("The loan already moved.");
    this.name = "StaleLoanError";
  }
}

export type MoveLoanState =
  | { ok: true; to: Stage; familyName: string }
  | { ok: false; error: string }
  | null;

export async function moveLoan(
  _previous: MoveLoanState,
  formData: FormData,
): Promise<MoveLoanState> {
  const parsed = MoveLoanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: "That move was not understood." };
  }
  const { loanId, to, closedReason, reason } = parsed.data;

  const actor = await requireActor();
  const loan = await getLoanForAction(actor, loanId);
  if (!loan) return { ok: false, error: "That loan no longer exists." };

  const conditions = await getGateConditions(actor, loan.id);
  // checkMove inside move() runs can() for the matrix row this move falls under, so a
  // direct POST from someone without the permission is refused here, not by the menu.
  const decision = move({ loan, to, actor, conditions, closedReason, reason });
  if (!decision.ok) return { ok: false, error: decision.error };

  try {
    await db().transaction(async (tx) => {
      // Compare-and-set on the stage we decided from. Two genuinely concurrent moves
      // would otherwise both pass the machine and write two rows for one transition,
      // and PLAN.md §6 invariant 4 says a move is exactly one activity row.
      const changed = await tx
        .update(loans)
        .set(decision.patch)
        .where(and(eq(loans.id, loan.id), eq(loans.stage, loan.stage)))
        .returning({ id: loans.id });
      if (changed.length === 0) throw new StaleLoanError();
      await logActivity(tx, {
        actor,
        loanId: loan.id,
        action: "loan.stage_changed",
        detail: { ...decision.detail },
      });
    });
  } catch (error) {
    if (error instanceof StaleLoanError) {
      return {
        ok: false,
        error: "That loan moved a moment ago. Reload and try again.",
      };
    }
    throw error;
  }

  revalidatePath("/pipeline");
  revalidatePath(`/loans/${loan.id}`, "layout");
  return { ok: true, to, familyName: loan.familyName };
}
