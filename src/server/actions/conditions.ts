"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { conditions } from "@/db/schema";
import { canClear, canDelete } from "@/lib/conditions";
import { logActivity } from "../activity";
import { type Actor, requireActor } from "../actor";
import { can, closedLoanReason } from "../authz";
import { resolveCondition } from "../documents";
import { getCondition } from "../queries/conditions";
import {
  countConditionDocuments,
  hasAcceptedDocument,
} from "../queries/documents";
import { getLoanForAction } from "../queries/loans";
import {
  AddConditionSchema,
  ClearConditionSchema,
  type ConditionField,
  DeleteConditionSchema,
  EditConditionSchema,
  WaiveConditionSchema,
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
  // Ordered so the truer sentence wins: `can()` now refuses a write on a terminal loan
  // as well (PLAN.md §6 invariant 8), and "this loan is funded" tells a processor more
  // than a message about roles would.
  const closed = closedLoanReason(loan, "Its needs list is closed.");
  if (closed) return { ok: false, errors: {}, error: closed };
  if (!can(actor, "condition.manage", loan)) {
    return {
      ok: false,
      errors: {},
      error:
        "Only this loan's officer or a processor can change its needs list.",
    };
  }

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
  // Ordered so the truer sentence wins: `can()` now refuses a write on a terminal loan
  // as well (PLAN.md §6 invariant 8), and "this loan is funded" tells a processor more
  // than a message about roles would.
  const closed = closedLoanReason(loan, "Its needs list is closed.");
  if (closed) return { ok: false, errors: {}, error: closed };
  if (!can(actor, "condition.manage", loan)) {
    return {
      ok: false,
      errors: {},
      error:
        "Only this loan's officer or a processor can change its needs list.",
    };
  }
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
  // Ordered so the truer sentence wins: `can()` now refuses a write on a terminal loan
  // as well (PLAN.md §6 invariant 8), and "this loan is funded" tells a processor more
  // than a message about roles would.
  const closed = closedLoanReason(loan, "Its needs list is closed.");
  if (closed) return { ok: false, errors: {}, error: closed };
  if (!can(actor, "condition.manage", loan)) {
    return {
      ok: false,
      errors: {},
      error:
        "Only this loan's officer or a processor can change its needs list.",
    };
  }
  const condition = await getCondition(actor, loan.id, data.conditionId);
  if (!condition) {
    return {
      ok: false,
      errors: {},
      error: "That condition is no longer on this loan.",
    };
  }
  // PLAN.md §6 invariant 9: deletable only while untouched. A condition that has been
  // answered, or that any document was ever hung on, is waived instead — a rejected
  // upload is still a thing the borrower sent, and the trail has to survive.
  const documentCount = await countConditionDocuments(actor, condition.id);
  if (!canDelete(condition.status, documentCount)) {
    return {
      ok: false,
      errors: {},
      error:
        documentCount > 0
          ? `${condition.title} already has a document on it. Waive it instead of removing it.`
          : `${condition.title} has already been answered. Waive it instead of removing it.`,
    };
  }

  try {
    await db().transaction(async (tx) => {
      // Compare-and-set on the status the check was made against: a processor answering
      // this condition between the read and the write must not have it deleted out from
      // under them, with the log claiming it was still unanswered.
      // A document arriving here would have moved the status off "requested", so the
      // compare-and-set covers invariant 9's second half as well as its first.
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

type ResolveContext =
  | { ok: false; error: string }
  | {
      ok: true;
      actor: Actor;
      loan: NonNullable<Awaited<ReturnType<typeof getLoanForAction>>>;
      condition: NonNullable<Awaited<ReturnType<typeof getCondition>>>;
    };

/**
 * The load and the checks that clearing and waiving share. `condition.resolve` is the
 * matrix row for both (PLAN.md §2): a processor on any loan, never a loan officer.
 */
async function loadForResolve(
  loanId: string,
  conditionId: string,
): Promise<ResolveContext> {
  const actor = await requireActor();
  const loan = await getLoanForAction(actor, loanId);
  if (!loan) return { ok: false, error: "That loan no longer exists." };

  const closed = closedLoanReason(loan, "Its needs list is closed.");
  if (closed) return { ok: false, error: closed };
  if (!can(actor, "condition.resolve", loan)) {
    return {
      ok: false,
      error: "Only a processor can clear or waive a condition.",
    };
  }

  const condition = await getCondition(actor, loan.id, conditionId);
  if (!condition) {
    return { ok: false, error: "That condition is no longer on this loan." };
  }
  return { ok: true, actor, loan, condition };
}

export type ResolveConditionState =
  | { ok: true; title: string; to: "cleared" | "waived" }
  | { ok: false; error: string }
  | null;

/**
 * Clear a condition (PLAN.md §2 row `condition.resolve`). It needs an accepted document:
 * clearing asserts that a human looked at something. When nothing will ever arrive, the
 * way out is a waiver with a reason, not a clear.
 */
export async function clearCondition(
  _previous: ResolveConditionState,
  formData: FormData,
): Promise<ResolveConditionState> {
  const parsed = ClearConditionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: "That condition was not understood." };
  }
  const loaded = await loadForResolve(
    parsed.data.loanId,
    parsed.data.conditionId,
  );
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { actor, loan, condition } = loaded;

  const accepted = await hasAcceptedDocument(actor, condition.id);
  if (!canClear(condition.status, accepted)) {
    if (condition.status === "cleared" || condition.status === "waived") {
      return {
        ok: false,
        error: `${condition.title} is already ${condition.status}.`,
      };
    }
    return {
      ok: false,
      error: `${condition.title} has no accepted document yet. Accept one, or waive it with a reason.`,
    };
  }

  const applied = await db().transaction(async (tx) =>
    resolveCondition(tx, {
      conditionId: condition.id,
      from: condition.status,
      to: "cleared",
      reviewerId: actor.userId,
      activity: {
        actor,
        loanId: loan.id,
        action: "condition.cleared",
        detail: { conditionId: condition.id, title: condition.title },
      },
    }),
  );
  if (!applied) {
    return {
      ok: false,
      error: `${condition.title} changed a moment ago. Reload and try again.`,
    };
  }

  revalidatePath(`/loans/${loan.id}`, "layout");
  revalidatePath("/pipeline");
  revalidatePath("/queue");
  return { ok: true, title: condition.title, to: "cleared" };
}

/**
 * Waive a condition with a reason. The borrower's page shows only "No longer needed" —
 * the reason is a note between staff, kept in the activity row (PLAN.md §6).
 */
export async function waiveCondition(
  _previous: ResolveConditionState,
  formData: FormData,
): Promise<ResolveConditionState> {
  const parsed = WaiveConditionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "That condition was not understood.",
    };
  }
  const { loanId, conditionId, reason } = parsed.data;
  const loaded = await loadForResolve(loanId, conditionId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { actor, loan, condition } = loaded;

  if (condition.status === "cleared" || condition.status === "waived") {
    return {
      ok: false,
      error: `${condition.title} is already ${condition.status}.`,
    };
  }

  const applied = await db().transaction(async (tx) =>
    resolveCondition(tx, {
      conditionId: condition.id,
      from: condition.status,
      to: "waived",
      reviewerId: actor.userId,
      activity: {
        actor,
        loanId: loan.id,
        action: "condition.waived",
        detail: { conditionId: condition.id, title: condition.title, reason },
      },
    }),
  );
  if (!applied) {
    return {
      ok: false,
      error: `${condition.title} changed a moment ago. Reload and try again.`,
    };
  }

  revalidatePath(`/loans/${loan.id}`, "layout");
  revalidatePath("/pipeline");
  revalidatePath("/queue");
  return { ok: true, title: condition.title, to: "waived" };
}
