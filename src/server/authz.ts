import { eq, inArray, type SQL } from "drizzle-orm";
import { loans } from "@/db/schema";
import type { Role } from "@/lib/roles";
import { ACTIVE_STAGES } from "@/lib/stages";
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
    "analytics.view": "own",
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

/** The slice of a loan that ownership checks need. */
export type OwnedLoan = { loanOfficerId: string };

/**
 * May this actor perform `action`? An `"own"` cell needs the loan to resolve; without
 * one it is refused, so a caller can never forget to load the loan.
 */
export function can(actor: Actor, action: Action, loan?: OwnedLoan): boolean {
  const permission = POLICY[actor.role][action];
  if (permission === "any") return true;
  if (permission === "own") return loan?.loanOfficerId === actor.userId;
  return false;
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
