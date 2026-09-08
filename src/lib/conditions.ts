/**
 * Condition (needs-list item) vocabulary: status values with staff and borrower labels,
 * and the prior-to bucket that says when a condition must be satisfied (PLAN.md §6).
 * `src/db/schema.ts` builds the Postgres enums from these arrays.
 */

export const CONDITION_STATUSES = [
  "requested",
  "received",
  "cleared",
  "waived",
] as const;

export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

const STAFF_LABELS = {
  requested: "Requested",
  received: "Received",
  cleared: "Cleared",
  waived: "Waived",
} as const satisfies Record<ConditionStatus, string>;

const BORROWER_LABELS = {
  requested: "Needed",
  received: "Received, under review",
  cleared: "Accepted",
  waived: "No longer needed",
} as const satisfies Record<ConditionStatus, string>;

export function conditionStaffLabel(status: ConditionStatus): string {
  return STAFF_LABELS[status];
}

/**
 * Borrower-facing label. A `requested` condition whose last upload was rejected reads
 * "Needs another: <reason>" instead of "Needed".
 */
export function conditionBorrowerLabel(
  status: ConditionStatus,
  lastRejectionReason?: string | null,
): string {
  if (status === "requested" && lastRejectionReason) {
    return `Needs another: ${lastRejectionReason}`;
  }
  return BORROWER_LABELS[status];
}

/** Open means still waiting on the borrower or the reviewer. */
export const OPEN_CONDITION_STATUSES = ["requested", "received"] as const;

export function isOpenCondition(status: ConditionStatus): boolean {
  return (OPEN_CONDITION_STATUSES as readonly string[]).includes(status);
}

/** When a condition must be satisfied: before approval, before closing documents, or before funding. */
export const PRIOR_TO = ["approval", "docs", "funding"] as const;

export type PriorTo = (typeof PRIOR_TO)[number];

const PRIOR_TO_LABELS = {
  approval: "before approval",
  docs: "before docs",
  funding: "before funding",
} as const satisfies Record<PriorTo, string>;

export function priorToLabel(priorTo: PriorTo): string {
  return PRIOR_TO_LABELS[priorTo];
}
