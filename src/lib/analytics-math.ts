import { daysSince, daysUntil } from "./format";
import { type ActiveStage, isActiveStage, type Stage } from "./stages";

/**
 * Pure analytics formulas (PLAN.md §7). Phase 2 needs only the "needs attention" rule,
 * which the pipeline card and — from Phase 4 — the dashboard's Needs attention table
 * both read, so the thresholds live in exactly one place. Every function is pure and
 * takes `now`, so `tests/unit/analytics-math.test.ts` can pin the date.
 */

/** Days in a stage after which a file is stalled. Lead and Application have no clock. */
export const STALLED_AFTER_DAYS = {
  processing: 10,
  underwriting: 5,
  conditional_approval: 7,
  clear_to_close: 5,
} as const satisfies Partial<Record<ActiveStage, number>>;

/** A target close inside this many days, on a file not yet clear to close, is a risk. */
export const CLOSING_SOON_DAYS = 14;

export type Attention =
  | { kind: "needs_review"; pendingDocuments: number }
  | { kind: "stalled"; stage: ActiveStage; days: number }
  | { kind: "closing_soon"; days: number };

export type AttentionKind = Attention["kind"];

export type AttentionInput = {
  stage: Stage;
  stageEnteredAt: Date;
  targetCloseDate: string | null;
  /** Documents on this loan still waiting on a reviewer. */
  pendingDocuments: number;
};

const STALLED_TABLE: Partial<Record<ActiveStage, number>> = STALLED_AFTER_DAYS;

/**
 * Every reason this loan wants attention, worst first: a file that has stopped moving
 * outranks a document waiting on a reviewer, which outranks a closing date approaching a
 * file that is not yet clear to close — the order the design frames put on the four
 * flagged cards. A pipeline card shows the first; the dashboard table (Phase 4) filters
 * to the two reasons PLAN.md §7 defines for it. Terminal loans need nothing.
 */
export function attentionsFor(
  loan: AttentionInput,
  now: Date = new Date(),
): Attention[] {
  if (!isActiveStage(loan.stage)) return [];
  const found: Attention[] = [];
  const threshold = STALLED_TABLE[loan.stage];
  const days = daysSince(loan.stageEnteredAt, now);
  if (threshold !== undefined && days > threshold) {
    found.push({ kind: "stalled", stage: loan.stage, days });
  }
  if (loan.pendingDocuments > 0) {
    found.push({
      kind: "needs_review",
      pendingDocuments: loan.pendingDocuments,
    });
  }
  if (loan.targetCloseDate && loan.stage !== "clear_to_close") {
    const until = daysUntil(loan.targetCloseDate, now);
    if (until >= 0 && until <= CLOSING_SOON_DAYS) {
      found.push({ kind: "closing_soon", days: until });
    }
  }
  return found;
}

/** The one reason a pipeline card shows, or null when the file is healthy. */
export function primaryAttention(
  loan: AttentionInput,
  now: Date = new Date(),
): Attention | null {
  return attentionsFor(loan, now)[0] ?? null;
}

const ATTENTION_LABELS = {
  needs_review: "Needs review",
  stalled: "Stalled",
  closing_soon: "Closing soon",
} as const satisfies Record<AttentionKind, string>;

/** Short form for the tag on a loan card. */
export function attentionLabel(attention: Attention): string {
  return ATTENTION_LABELS[attention.kind];
}
