"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { conditions } from "@/db/schema";
import { logActivity } from "../activity";
import { requireActor } from "../actor";
import { can, closedLoanReason } from "../authz";
import { getCondition } from "../queries/conditions";
import { getLoanForAction } from "../queries/loans";
import {
  AddConditionSchema,
  type ConditionField,
  DeleteConditionSchema,
  EditConditionSchema,
} from "./schemas";

/**
 * Needs-list mutations (PLAN.md §2 row `condition.manage`: a loan officer on their own
 * files, a processor on any). Clearing and waiving are `condition.resolve` and arrive
 * with documents in Phase 3; nothing here changes a condition's status.
 *
 * Each one loads the loan first so `can()` has something to resolve "own" against, then
 * loads the condition scoped by that loan, so a condition id from another file cannot be
 * reached through a loan the actor does own.
 */

export type ConditionState =
  | { ok: true; title: string }
  | {
      ok: false;
      errors: Partial<Record<ConditionField, string>>;
      error?: string;
    }
  | null;

/** The condition stopped being `requested` before the delete landed. */
class StaleConditionError extends Error {
  constructor() {
    super("The condition was answered.");
    this.name = "StaleConditionError";
  }
}

/** The fields the dialog actually prints an error under. */
const SHOWN_FIELDS = ["title", "instructions", "priorTo"] as const;

/**
 * The zod issues that belong to a field, for the form to print under it — plus a general
 * message when every issue landed on a field the dialog does not render, so a validation
 * failure can never be a silent no-op.
 */
function fieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): { errors: Partial<Record<ConditionField, string>>; error?: string } {
  const errors: Partial<Record<ConditionField, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field as ConditionField]) {
      errors[field as ConditionField] = issue.message;
    }
  }
  return SHOWN_FIELDS.some((field) => errors[field])
    ? { errors }
    : { errors, error: "That condition was not understood." };
}

/** A new condition starts `requested`: nobody has sent anything for it yet. */
export async function addCondition(
  _previous: ConditionState,
  formData: FormData,
): Promise<ConditionState> {
  const parsed = AddConditionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, ...fieldErrors(parsed.error.issues) };
  }
  const data = parsed.data;

  const actor = await requireActor();
  const loan = await getLoanForAction(actor, data.loanId);
  if (!loan)
    return { ok: false, errors: {}, error: "That loan no longer exists." };
  if (!can(actor, "condition.manage", loan)) {
    return {
      ok: false,
      errors: {},
      error:
        "Only this loan's officer or a processor can change its needs list.",
    };
  }
  const closed = closedLoanReason(loan, "Its needs list is closed.");
  if (closed) return { ok: false, errors: {}, error: closed };

  await db().transaction(async (tx) => {
    const [created] = await tx
      .insert(conditions)
      .values({
        loanId: loan.id,
        title: data.title,
        instructions: data.instructions,
        priorTo: data.priorTo,
        borrowerFacing: data.borrowerFacing,
        createdBy: actor.userId,
      })
      .returning({ id: conditions.id });
    if (!created) throw new Error("The condition insert returned no row.");
    await logActivity(tx, {
      actor,
      loanId: loan.id,
      action: "condition.created",
      detail: { conditionId: created.id, title: data.title },
    });
  });

  revalidatePath(`/loans/${loan.id}`, "layout");
  // Open conditions gate the moves the board offers, so its menus go stale otherwise.
  revalidatePath("/pipeline");
  return { ok: true, title: data.title };
}

export async function editCondition(
  _previous: ConditionState,
  formData: FormData,
): Promise<ConditionState> {
  const parsed = EditConditionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, ...fieldErrors(parsed.error.issues) };
  }
  const data = parsed.data;

  const actor = await requireActor();
  const loan = await getLoanForAction(actor, data.loanId);
  if (!loan)
    return { ok: false, errors: {}, error: "That loan no longer exists." };
  if (!can(actor, "condition.manage", loan)) {
    return {
      ok: false,
      errors: {},
      error:
        "Only this loan's officer or a processor can change its needs list.",
    };
  }
  const closed = closedLoanReason(loan, "Its needs list is closed.");
  if (closed) return { ok: false, errors: {}, error: closed };
  const condition = await getCondition(actor, loan.id, data.conditionId);
  if (!condition) {
    return {
      ok: false,
      errors: {},
      error: "That condition is no longer on this loan.",
    };
  }

  await db().transaction(async (tx) => {
    await tx
      .update(conditions)
      .set({
        title: data.title,
        instructions: data.instructions ?? null,
        priorTo: data.priorTo,
        borrowerFacing: data.borrowerFacing,
      })
      .where(
        and(eq(conditions.id, condition.id), eq(conditions.loanId, loan.id)),
      );
    await logActivity(tx, {
      actor,
      loanId: loan.id,
      action: "condition.updated",
      detail: { conditionId: condition.id, title: data.title },
    });
  });

  revalidatePath(`/loans/${loan.id}`, "layout");
  // Open conditions gate the moves the board offers, so its menus go stale otherwise.
  revalidatePath("/pipeline");
  return { ok: true, title: data.title };
}

/**
 * Remove a condition from the list — but only one still `requested`, meaning nothing has
 * been sent for it. From `received` on there is at least one document pointing at it
 * (PLAN.md §6 invariant 3) and `documents.condition_id` is `ON DELETE SET NULL`, so
 * removing the row would silently orphan a live upload rather than fail. Cleared and
 * waived are decisions someone made.
 *
 * Editing has no such limit: the activity log keeps its own copy of the title, so
 * renaming a resolved condition leaves the history intact.
 */
export async function deleteCondition(
  _previous: ConditionState,
  formData: FormData,
): Promise<ConditionState> {
  const parsed = DeleteConditionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      errors: {},
      error: "That condition was not understood.",
    };
  }
  const data = parsed.data;

  const actor = await requireActor();
  const loan = await getLoanForAction(actor, data.loanId);
  if (!loan)
    return { ok: false, errors: {}, error: "That loan no longer exists." };
  if (!can(actor, "condition.manage", loan)) {
    return {
      ok: false,
      errors: {},
      error:
        "Only this loan's officer or a processor can change its needs list.",
    };
  }
  const closed = closedLoanReason(loan, "Its needs list is closed.");
  if (closed) return { ok: false, errors: {}, error: closed };
  const condition = await getCondition(actor, loan.id, data.conditionId);
  if (!condition) {
    return {
      ok: false,
      errors: {},
      error: "That condition is no longer on this loan.",
    };
  }
  if (condition.status !== "requested") {
    return {
      ok: false,
      errors: {},
      error: `${condition.title} has already been answered. Waive it instead of removing it.`,
    };
  }

  try {
    await db().transaction(async (tx) => {
      // Compare-and-set on the status the check was made against: a processor answering
      // this condition between the read and the write must not have it deleted out from
      // under them, with the log claiming it was still unanswered.
      const removed = await tx
        .delete(conditions)
        .where(
          and(
            eq(conditions.id, condition.id),
            eq(conditions.loanId, loan.id),
            eq(conditions.status, "requested"),
          ),
        )
        .returning({ id: conditions.id });
      if (removed.length === 0) throw new StaleConditionError();
      await logActivity(tx, {
        actor,
        loanId: loan.id,
        action: "condition.deleted",
        detail: { conditionId: condition.id, title: condition.title },
      });
    });
  } catch (error) {
    if (error instanceof StaleConditionError) {
      return {
        ok: false,
        errors: {},
        error: `${condition.title} was answered a moment ago. Reload and try again.`,
      };
    }
    throw error;
  }

  revalidatePath(`/loans/${loan.id}`, "layout");
  // Open conditions gate the moves the board offers, so its menus go stale otherwise.
  revalidatePath("/pipeline");
  return { ok: true, title: condition.title };
}
