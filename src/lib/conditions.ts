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

/**
 * PLAN.md §6 invariant 3 and invariant 9, as pure decisions over the rows an action has
 * already loaded. They live here rather than in the action so the rules are tested
 * without a database and stated once; the actions apply them inside their transaction.
 */

/**
 * The status a condition takes when a document is registered against it. Only a
 * `requested` item moves — a second upload onto something already `received` changes
 * nothing, and a `cleared` or `waived` item is settled. Returns null when it stays put,
 * so the caller can skip the write.
 */
export function statusAfterUpload(
  current: ConditionStatus,
): ConditionStatus | null {
  return current === "requested" ? "received" : null;
}

/**
 * The status a condition takes when one of its documents is rejected. It reopens only if
 * nothing accepted is left to stand on: a condition holding an accepted pay stub and a
 * rejected duplicate is still answered.
 *
 * A `cleared` condition reopens too. Clearing asserts an accepted document exists, so
 * rejecting the last one takes away the thing the clearance rested on — PLAN.md §6
 * invariant 3 says "if no other accepted document remains", without qualifying which
 * status it was in. A waived one stays waived: it was closed on a decision, not on a
 * document.
 */
export function statusAfterRejection(
  current: ConditionStatus,
  hasOtherAcceptedDocument: boolean,
): ConditionStatus | null {
  if (hasOtherAcceptedDocument) return null;
  return current === "received" || current === "cleared" ? "requested" : null;
}

/**
 * May this condition be cleared? Clearing asserts a human looked at something, so it
 * needs an accepted document. Waiving is the way out when no document will ever arrive.
 */
export function canClear(
  current: ConditionStatus,
  hasAcceptedDocument: boolean,
): boolean {
  if (current === "cleared" || current === "waived") return false;
  return hasAcceptedDocument;
}

/**
 * May this condition be deleted? Only while it is untouched: still `requested`, with no
 * document ever hung on it (PLAN.md §6 invariant 9). Anything else is waived instead, so
 * the paper trail survives.
 */
export function canDelete(
  current: ConditionStatus,
  documentCount: number,
): boolean {
  return current === "requested" && documentCount === 0;
}
