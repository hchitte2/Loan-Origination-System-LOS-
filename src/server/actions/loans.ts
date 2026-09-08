"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { conditions, loans } from "@/db/schema";
import { defaultNeedsList } from "@/lib/needs-list";
import { isTerminalStage, type Stage, staffLabel } from "@/lib/stages";
import { logActivity } from "../activity";
import { requireActor } from "../actor";
import { can } from "../authz";
import { getGateConditions } from "../queries/conditions";
import { familyName, getLoanForAction } from "../queries/loans";
import { move } from "../transitions";
import {
  type CreateLoanField,
  CreateLoanSchema,
  MoveLoanSchema,
  RegenerateLinkSchema,
} from "./schemas";

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

  const gateConditions = await getGateConditions(actor, loan.id);
  // checkMove inside move() runs can() for the matrix row this move falls under, so a
  // direct POST from someone without the permission is refused here, not by the menu.
  const decision = move({
    loan,
    to,
    actor,
    conditions: gateConditions,
    closedReason,
    reason,
  });
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

/** What the borrower typed, echoed back so a failed submit keeps the form filled. */
/**
 * The borrower's public link: 32 URL-safe characters from the CSPRNG. The seed derives
 * its tokens deterministically so fixtures reproduce; a real loan must not be guessable.
 */
function newUploadToken(): string {
  return randomBytes(24).toString("base64url");
}

export type CreateLoanValues = Partial<Record<CreateLoanField, string>>;

export type CreateLoanState =
  | { ok: true; loanId: string; familyName: string }
  | {
      ok: false;
      errors: Partial<Record<CreateLoanField, string>>;
      error?: string;
    }
  | null;

const CREATE_LOAN_FIELDS = [
  "borrowerName",
  "borrowerEmail",
  "borrowerPhone",
  "propertyAddress",
  "purpose",
  "loanType",
  "amount",
  "referralSource",
  "targetCloseDate",
] as const satisfies readonly CreateLoanField[];

/**
 * Create a loan in `lead` with its default needs list (PLAN.md §6 invariant 6). The
 * conditions, the loan and the one activity row land in a single transaction, so a file
 * can never exist without the list the borrower will be asked for.
 *
 * The creator is the assigned loan officer, which is what makes "own" mean anything on
 * the permission matrix. A superadmin creating a loan owns it the same way.
 */
export async function createLoan(
  _previous: CreateLoanState,
  formData: FormData,
): Promise<CreateLoanState> {
  const parsed = CreateLoanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Partial<Record<CreateLoanField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        typeof field === "string" &&
        (CREATE_LOAN_FIELDS as readonly string[]).includes(field) &&
        !errors[field as CreateLoanField]
      ) {
        errors[field as CreateLoanField] = issue.message;
      }
    }
    return { ok: false, errors };
  }

  const actor = await requireActor();
  // A processor cannot create loans. This returns rather than throws because there is a
  // non-attack path into it: a superadmin who starts "View as Sam" in another tab and
  // then submits a dialog they opened as themselves.
  if (!can(actor, "loan.create")) {
    return {
      ok: false,
      errors: {},
      error: "Your role does not create loans.",
    };
  }
  const data = parsed.data;

  // The calendar disables past days in the browser's timezone, so a UTC "today" would
  // refuse a date the form had just offered to anyone west of UTC. A day of slack costs
  // nothing here and removes the disagreement.
  const yesterdayUtc = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (data.targetCloseDate && data.targetCloseDate < yesterdayUtc) {
    return {
      ok: false,
      errors: { targetCloseDate: "Pick a date that has not passed." },
    };
  }
  const loanId = await db().transaction(async (tx) => {
    const [created] = await tx
      .insert(loans)
      .values({
        borrowerName: data.borrowerName,
        borrowerEmail: data.borrowerEmail,
        borrowerPhone: data.borrowerPhone,
        propertyStreet: data.propertyAddress.street,
        propertyCity: data.propertyAddress.city,
        propertyState: data.propertyAddress.state,
        propertyZip: data.propertyAddress.zip,
        purpose: data.purpose,
        loanType: data.loanType,
        amount: data.amount,
        targetCloseDate: data.targetCloseDate,
        referralSource: data.referralSource,
        loanOfficerId: actor.userId,
        uploadToken: newUploadToken(),
      })
      .returning({ id: loans.id });
    if (!created) throw new Error("The loan insert returned no row.");

    await tx.insert(conditions).values(
      defaultNeedsList(data.purpose).map((item) => ({
        loanId: created.id,
        title: item.title,
        instructions: item.instructions,
        priorTo: item.priorTo,
        createdBy: actor.userId,
      })),
    );
    await logActivity(tx, {
      actor,
      loanId: created.id,
      action: "loan.created",
      detail: { borrowerName: data.borrowerName },
    });
    return created.id;
  });

  revalidatePath("/pipeline");
  return {
    ok: true,
    loanId,
    familyName: familyName(data.borrowerName),
  };
}

export type RegenerateLinkState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

/**
 * Issue a new borrower link and revoke the old one (PLAN.md §2 "Public link: copy,
 * regenerate"). The old token stops working the moment this commits, which is the point:
 * it is how a link sent to the wrong address is taken back.
 */
export async function regenerateLink(
  _previous: RegenerateLinkState,
  formData: FormData,
): Promise<RegenerateLinkState> {
  const parsed = RegenerateLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: "That loan was not understood." };

  const actor = await requireActor();
  const loan = await getLoanForAction(actor, parsed.data.loanId);
  if (!loan) return { ok: false, error: "That loan no longer exists." };
  // Returns rather than throws for the same reason createLoan does: a superadmin can
  // render this card as themselves and then start "View as" in another tab.
  if (!can(actor, "loan.manage_link", loan)) {
    return {
      ok: false,
      error: "Only the assigned loan officer or a processor can do that.",
    };
  }
  // The stage machine refuses every move on a terminal loan; the link that feeds it
  // should not be reissued either. Phase 3's public page will refuse the token anyway,
  // so this stops a new link being born dead.
  if (isTerminalStage(loan.stage)) {
    return {
      ok: false,
      error: `This loan is ${staffLabel(loan.stage).toLowerCase()}. Its borrower link is no longer used.`,
    };
  }

  await db().transaction(async (tx) => {
    await tx
      .update(loans)
      .set({ uploadToken: newUploadToken(), uploadTokenRevokedAt: null })
      .where(eq(loans.id, loan.id));
    await logActivity(tx, {
      actor,
      loanId: loan.id,
      action: "loan.link_regenerated",
    });
  });

  revalidatePath(`/loans/${loan.id}`, "layout");
  return { ok: true };
}
