import { eq, inArray, type SQL } from "drizzle-orm";
import { loans } from "@/db/schema";
import { type ConditionStatus, conditionBorrowerLabel } from "@/lib/conditions";
import {
  type LoanType,
  loanTypeLabel,
  type Purpose,
  purposeLabel,
} from "@/lib/loan-facts";
import type { Role } from "@/lib/roles";
import {
  ACTIVE_STAGES,
  borrowerLabel,
  isActiveStage,
  isTerminalStage,
  type Stage,
  staffLabel,
  stageIndex,
} from "@/lib/stages";
import { uploadPrefix } from "@/lib/uploads";
import type { Actor } from "./actor";

/**
 * The one authorization module (PLAN.md §2, transcribed 1:1).
 *
 * Every row of the permission matrix is one `Action`; every cell is `"any"` (allowed on
 * every loan), `"own"` (allowed on loans where the actor is the assigned loan officer) or
 * `false`. A matrix cell that reads `R` on a write row means the role may see the field
 * but not change it, so the write action is `false` for that role; reads are governed by
 * `loanScope()` and, for the public link, by `redactForPublic()` (Phase 3).
 *
 * Impersonation needs no special case: `requireActor()` returns the effective user, so a
 * superadmin viewing as Sam gets exactly Sam's column. The activity log records both ids.
 *
 * `tests/unit/authz.test.ts` iterates `POLICY` itself; docs, code and tests cannot drift.
 */

export const ACTIONS = [
  /** Loans: read scope (all staff see every loan; list surfaces filter by stage). */
  "loan.read",
  "loan.create",
  /** Edit borrower and property facts. */
  "loan.edit_facts",
  "loan.edit_borrower_name",
  /** Borrower email and phone. */
  "loan.edit_borrower_contact",
  /** Property, purpose, program, amount, purchase price. */
  "loan.edit_property_and_terms",
  /** Assigned loan officer: name and phone. */
  "loan.read_loan_officer",
  /** Stage moves among lead ↔ application ↔ processing, and withdrawn. */
  "loan.move_early",
  /** Stage moves processing → … → funded, one step back never below processing, and denied. */
  "loan.move_late",
  /** Stage and dates. */
  "loan.read_stage",
  /** Target close date, pre-approval amount and expiry. */
  "loan.edit_dates_and_preapproval",
  /** Conditions: add, edit, delete. */
  "condition.manage",
  /** Conditions: clear, waive. */
  "condition.resolve",
  /** Condition titles and status. */
  "condition.read",
  /** Condition rejection reason (written through document review). */
  "condition.edit_rejection_reason",
  "document.upload",
  "document.download",
  /** Documents: accept, reject with reason. */
  "document.review",
  /** Withdrawn / denied reason. */
  "loan.edit_closed_reason",
  /** Public link: copy, regenerate. */
  "loan.manage_link",
  /** Loan activity log. */
  "activity.read_loan",
  /** Users list, create user, impersonate. */
  "admin.manage_users",
  /** Global activity log, including impersonation events. */
  "admin.read_activity",
  "admin.reset_demo",
  /** Analytics: the query scopes the numbers (own / ops / everything). */
  "analytics.view",
] as const;

export type Action = (typeof ACTIONS)[number];

export type Permission = "any" | "own" | false;

export const POLICY: Record<Role, Record<Action, Permission>> = {
  loan_officer: {
    "loan.read": "any",
    "loan.create": "any",
    "loan.edit_facts": "own",
    "loan.edit_borrower_name": "own",
    "loan.edit_borrower_contact": "own",
    "loan.edit_property_and_terms": "own",
    "loan.read_loan_officer": "any",
    "loan.move_early": "own",
    "loan.move_late": false,
    "loan.read_stage": "any",
    "loan.edit_dates_and_preapproval": "own",
    "condition.manage": "own",
    "condition.resolve": false,
    "condition.read": "any",
    "condition.edit_rejection_reason": false,
    "document.upload": "own",
    "document.download": "any",
    "document.review": false,
    "loan.edit_closed_reason": "own",
    "loan.manage_link": "own",
    "activity.read_loan": "any",
    "admin.manage_users": false,
    "admin.read_activity": false,
    "admin.reset_demo": false,
    // "own" in PLAN.md §2 means the numbers are scoped to the officer's loans; there is
    // no loan to resolve ownership against, so the query applies the scope (§7).
    "analytics.view": "any",
  },
  processor: {
    "loan.read": "any",
    "loan.create": false,
    "loan.edit_facts": false,
    "loan.edit_borrower_name": false,
    "loan.edit_borrower_contact": false,
    "loan.edit_property_and_terms": false,
    "loan.read_loan_officer": "any",
    "loan.move_early": false,
    "loan.move_late": "any",
    "loan.read_stage": "any",
    "loan.edit_dates_and_preapproval": false,
    "condition.manage": "any",
    "condition.resolve": "any",
    "condition.read": "any",
    "condition.edit_rejection_reason": "any",
    "document.upload": "any",
    "document.download": "any",
    "document.review": "any",
    "loan.edit_closed_reason": "any",
    "loan.manage_link": "any",
    "activity.read_loan": "any",
    "admin.manage_users": false,
    "admin.read_activity": false,
    "admin.reset_demo": false,
    "analytics.view": "any",
  },
  superadmin: {
    "loan.read": "any",
    "loan.create": "any",
    "loan.edit_facts": "any",
    "loan.edit_borrower_name": "any",
    "loan.edit_borrower_contact": "any",
    "loan.edit_property_and_terms": "any",
    "loan.read_loan_officer": "any",
    "loan.move_early": "any",
    "loan.move_late": "any",
    "loan.read_stage": "any",
    "loan.edit_dates_and_preapproval": "any",
    "condition.manage": "any",
    "condition.resolve": "any",
    "condition.read": "any",
    "condition.edit_rejection_reason": "any",
    "document.upload": "any",
    "document.download": "any",
    "document.review": "any",
    "loan.edit_closed_reason": "any",
    "loan.manage_link": "any",
    "activity.read_loan": "any",
    "admin.manage_users": "any",
    "admin.read_activity": "any",
    "admin.reset_demo": "any",
    "analytics.view": "any",
  },
};

/**
 * The actions that change one particular loan (PLAN.md §6 invariant 8). Every one of
 * them needs the loan in hand — to resolve an `"own"` cell, and to see the stage — so
 * `can()` refuses when it is missing rather than trusting the caller to remember.
 *
 * The writes that are *not* here have no loan to be terminal: creating one, and the two
 * admin actions. Read actions are absent on purpose; a closed loan is still readable.
 */
export const LOAN_WRITE_ACTIONS = [
  "loan.edit_facts",
  "loan.edit_borrower_name",
  "loan.edit_borrower_contact",
  "loan.edit_property_and_terms",
  "loan.move_early",
  "loan.move_late",
  "loan.edit_dates_and_preapproval",
  "condition.manage",
  "condition.resolve",
  "condition.edit_rejection_reason",
  "document.upload",
  "document.review",
  "loan.edit_closed_reason",
  "loan.manage_link",
] as const satisfies readonly Action[];

const LOAN_WRITES: ReadonlySet<Action> = new Set(LOAN_WRITE_ACTIONS);

export function isLoanWrite(action: Action): boolean {
  return LOAN_WRITES.has(action);
}

/** The slice of a loan that ownership and the terminal check need. */
export type OwnedLoan = { loanOfficerId: string; stage: Stage };

/**
 * May this actor perform `action`?
 *
 * Two rules sit in front of the matrix, both for the same reason — a caller must not be
 * able to forget them:
 *
 * 1. A loan write without a loan is refused. An `"own"` cell has nothing to resolve, and
 *    an `"any"` cell would otherwise skip rule 2 entirely.
 * 2. A loan write on a terminal loan is refused for every role, superadmin included
 *    (PLAN.md §6 invariant 8). Funded, withdrawn and denied files are records, not
 *    workspaces: no fact edits, no condition changes, no uploads, no reviews. Putting it
 *    here means every write action inherits it instead of re-checking the stage, and
 *    every control that asks `can()` stops offering it.
 *
 * `closedLoanReason()` supplies the sentence a refused write should show.
 */
export function can(actor: Actor, action: Action, loan?: OwnedLoan): boolean {
  if (isLoanWrite(action)) {
    if (!loan) return false;
    if (isTerminalStage(loan.stage)) return false;
  }
  const permission = POLICY[actor.role][action];
  if (permission === "any") return true;
  if (permission === "own") return loan?.loanOfficerId === actor.userId;
  return false;
}

/**
 * A closed loan is a record, not a workspace. PLAN.md §5 scopes a processor's writes to
 * active loans; nothing on a funded, withdrawn or denied file should still be edited by
 * anyone, so this applies to every role rather than only the one the scope names.
 *
 * Returns the sentence to show, or null when the loan is still open. `what` completes it:
 * "Its needs list is closed."
 */
export function closedLoanReason(
  loan: { stage: Stage },
  what: string,
): string | null {
  if (!isTerminalStage(loan.stage)) return null;
  return `This loan is ${staffLabel(loan.stage).toLowerCase()}. ${what}`;
}

export class ForbiddenError extends Error {
  readonly action: Action;
  readonly role: Role;
  constructor(actor: Actor, action: Action) {
    super(`${actor.role} may not ${action}`);
    this.name = "ForbiddenError";
    this.action = action;
    this.role = actor.role;
  }
}

/** `can()` or throw. Server Actions call this before touching data. */
export function assertCan(
  actor: Actor,
  action: Action,
  loan?: OwnedLoan,
): void {
  if (!can(actor, action, loan)) throw new ForbiddenError(actor, action);
}

/**
 * Row filter for loan queries. Reads: every staff role sees every loan, including
 * terminal ones (list surfaces filter by stage themselves). Writes: a superadmin any
 * loan, a loan officer their own, a processor active loans only. `undefined` means no
 * filter; queries spread it into `where()`.
 */
export function loanScope(
  actor: Actor,
  mode: "read" | "write" = "read",
): SQL | undefined {
  if (mode === "read") return undefined;
  switch (actor.role) {
    case "superadmin":
      return undefined;
    case "loan_officer":
      return eq(loans.loanOfficerId, actor.userId);
    case "processor":
      return inArray(loans.stage, [...ACTIVE_STAGES]);
  }
}

/**
 * The borrower's view of their own loan (PLAN.md §2, "Public link" column).
 *
 * This is the whole of what `/u/[token]` may render. The rule in `.claude/rules/public.md`
 * is that the page never fetches more and hides it in a component — a Server Component
 * serialises what it fetches, so anything loaded is in the HTML whether or not it is
 * drawn. So the shape is built here, once, and the public components accept only it.
 *
 * Absent on purpose: the borrower's own email and phone of record, every staff name but
 * the loan officer's, internal conditions, document ids and download links, the activity
 * log, the upload token, and every enum value.
 */
export type PublicLoanView = {
  /**
   * The Blob folder this loan's uploads belong in — `uploads/<loanId>/`. It reaches the
   * browser because the upload has to be addressed somewhere, and the loan id is not a
   * secret from the person already holding a link to the loan: every staff route needs a
   * session, and the route re-derives the loan from the token regardless. Nothing renders
   * it.
   */
  uploadPrefix: string;
  borrowerFirstName: string;
  /** "412 Maple Ave, Austin TX" — street and city, never the ZIP. */
  property: string;
  amount: number;
  /** "Conventional purchase". */
  programLabel: string;
  /** The borrower's words for the stage, never `processing`. */
  stageLabel: string;
  /** Where the tracker's marker sits, 0–5. */
  stageIndex: number;
  targetCloseDate: string | null;
  loanOfficer: { firstName: string; name: string; phone: string | null };
  conditions: PublicConditionView[];
};

export type PublicConditionView = {
  id: string;
  title: string;
  /** The borrower-facing wording. Hidden once the item is accepted. */
  instructions: string | null;
  status: ConditionStatus;
  /** "Needed", "Received, under review", "Accepted", "Needs another: <reason>". */
  statusLabel: string;
  /** Whether an upload box belongs under it. */
  acceptsUploads: boolean;
  /** What this borrower has sent for it. File names and dates only — never bytes. */
  documents: { fileName: string; sentOn: Date }[];
};

/** The rows `redactForPublic` reduces. Loaded by `queries/public.ts`, never by a page. */
export type PublicSource = {
  loan: {
    id: string;
    borrowerName: string;
    propertyStreet: string;
    propertyCity: string;
    propertyState: string;
    amount: number;
    purpose: Purpose;
    loanType: LoanType;
    stage: Stage;
    targetCloseDate: string | null;
  };
  loanOfficer: { name: string; phone: string | null };
  conditions: {
    id: string;
    title: string;
    instructions: string | null;
    status: ConditionStatus;
    borrowerFacing: boolean;
    lastRejectionReason: string | null;
  }[];
  documents: {
    conditionId: string | null;
    fileName: string;
    createdAt: Date;
    uploadedVia: "staff" | "public_link";
  }[];
};

export function redactForPublic(source: PublicSource): PublicLoanView {
  const { loan } = source;
  return {
    uploadPrefix: uploadPrefix(loan.id),
    borrowerFirstName: firstName(loan.borrowerName),
    property: `${loan.propertyStreet}, ${loan.propertyCity} ${loan.propertyState}`,
    amount: loan.amount,
    programLabel: `${loanTypeLabel(loan.loanType)} ${purposeLabel(loan.purpose).toLowerCase()}`,
    stageLabel: borrowerLabel(loan.stage),
    // A public page only ever resolves from a live token, which refuses terminal loans,
    // so the stage is always one of the six the tracker draws.
    stageIndex: isActiveStage(loan.stage) ? stageIndex(loan.stage) : 0,
    targetCloseDate: loan.targetCloseDate,
    loanOfficer: {
      firstName: firstName(source.loanOfficer.name),
      name: source.loanOfficer.name,
      phone: source.loanOfficer.phone,
    },
    conditions: source.conditions
      .filter((condition) => condition.borrowerFacing)
      .map((condition) => ({
        id: condition.id,
        title: condition.title,
        // An accepted item needs no instructions; the frame drops them once it is done.
        instructions:
          condition.status === "cleared" ? null : condition.instructions,
        status: condition.status,
        statusLabel: conditionBorrowerLabel(
          condition.status,
          condition.lastRejectionReason,
        ),
        // Only an item still being asked for gets a box. One under review already has
        // what it needs — frame 05-public-desktop draws the W-2 card with its file and
        // no zone — and a cleared or waived one is done.
        acceptsUploads: condition.status === "requested",
        documents: source.documents
          .filter(
            (document) =>
              document.conditionId === condition.id &&
              // Their own uploads only. A file a processor added on their behalf is not
              // something the borrower sent, and showing it would confuse "what I sent".
              document.uploadedVia === "public_link",
          )
          .map((document) => ({
            fileName: document.fileName,
            sentOn: document.createdAt,
          })),
      })),
  };
}

/** "Maria Chen" → "Maria". The public page addresses people by first name. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
