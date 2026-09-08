/**
 * The loan lifecycle: the single source of stage values and labels (PLAN.md §6).
 *
 * `src/db/schema.ts` builds the Postgres enum from `STAGES`; every screen reads labels
 * from here. Staff see the staff label; the borrower page shows the borrower label and
 * never an enum value.
 */

export const STAGES = [
  "lead",
  "application",
  "processing",
  "underwriting",
  "conditional_approval",
  "clear_to_close",
  "funded",
  "withdrawn",
  "denied",
] as const;

export type Stage = (typeof STAGES)[number];

export function isStage(value: unknown): value is Stage {
  return (
    typeof value === "string" && (STAGES as readonly string[]).includes(value)
  );
}

/** The six pipeline columns, in order. */
export const ACTIVE_STAGES = [
  "lead",
  "application",
  "processing",
  "underwriting",
  "conditional_approval",
  "clear_to_close",
] as const;

export type ActiveStage = (typeof ACTIVE_STAGES)[number];

/** Stages a loan never leaves. */
export const TERMINAL_STAGES = ["funded", "withdrawn", "denied"] as const;

export type TerminalStage = (typeof TERMINAL_STAGES)[number];

export function isActiveStage(stage: Stage): stage is ActiveStage {
  return (ACTIVE_STAGES as readonly string[]).includes(stage);
}

export function isTerminalStage(stage: Stage): stage is TerminalStage {
  return (TERMINAL_STAGES as readonly string[]).includes(stage);
}

/** Position of an active stage in the pipeline, 0 for `lead` through 5 for `clear_to_close`. */
export function stageIndex(stage: ActiveStage): number {
  return ACTIVE_STAGES.indexOf(stage);
}

const STAFF_LABELS = {
  lead: "Lead",
  application: "Application",
  processing: "Processing",
  underwriting: "Underwriting",
  conditional_approval: "Conditional approval",
  clear_to_close: "Clear to close",
  funded: "Funded",
  withdrawn: "Withdrawn",
  denied: "Denied",
} as const satisfies Record<Stage, string>;

const BORROWER_LABELS = {
  lead: "Getting started",
  application: "Application received",
  processing: "Gathering your documents",
  underwriting: "In underwriting review",
  conditional_approval: "Conditionally approved",
  clear_to_close: "Clear to close",
  funded: "Closed and funded",
  withdrawn: "Application withdrawn",
  denied: "Not approved",
} as const satisfies Record<Stage, string>;

/** Label for staff screens: "Conditional approval". */
export function staffLabel(stage: Stage): string {
  return STAFF_LABELS[stage];
}

/** Label for the borrower page: "Conditionally approved". */
export function borrowerLabel(stage: Stage): string {
  return BORROWER_LABELS[stage];
}

/** Why a loan left the pipeline; mirrors HMDA action-taken codes. */
export const CLOSED_REASONS = [
  "withdrawn_by_applicant",
  "incomplete",
  "credit",
  "collateral",
  "other",
] as const;

export type ClosedReason = (typeof CLOSED_REASONS)[number];

const CLOSED_REASON_LABELS = {
  withdrawn_by_applicant: "Withdrawn by applicant",
  incomplete: "Incomplete file",
  credit: "Credit",
  collateral: "Collateral",
  other: "Other",
} as const satisfies Record<ClosedReason, string>;

export function closedReasonLabel(reason: ClosedReason): string {
  return CLOSED_REASON_LABELS[reason];
}
