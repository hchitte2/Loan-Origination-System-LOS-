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

// ---------------------------------------------------------------------------------------
// Dashboard formulas (PLAN.md §7 "Definitions")
// ---------------------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/**
 * How open conditions are aged, on the queue and on the dashboard. The edges are
 * inclusive upper bounds in whole days; the last bucket is open-ended.
 */
export const AGING_BUCKETS = [
  { label: "0–3 d", maxDays: 3 },
  { label: "4–7 d", maxDays: 7 },
  { label: "8–14 d", maxDays: 14 },
  { label: "15+ d", maxDays: null },
] as const;

export type AgingBucket = { label: string; count: number };

/**
 * Count open conditions into the four age buckets. Always returns all four, at zero if
 * need be, so the chart keeps its shape on a quiet day instead of collapsing to one bar.
 */
export function agingBuckets(
  createdAts: readonly Date[],
  now: Date = new Date(),
): AgingBucket[] {
  const counted = AGING_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: 0,
  }));
  for (const createdAt of createdAts) {
    const age = daysSince(createdAt, now);
    const index = AGING_BUCKETS.findIndex(
      (bucket) => bucket.maxDays === null || age <= bucket.maxDays,
    );
    const target = counted[index];
    if (target) target.count += 1;
  }
  return counted;
}

/** The cohort window for pull-through, in days before today. Both edges count. */
export const PULL_THROUGH_WINDOW = { oldest: 180, newest: 60 } as const;

/** Only loans funded within this many days feed the cycle-time average. */
export const CYCLE_TIME_WINDOW_DAYS = 90;

/** The two dates every dashboard rate is computed from. */
export type CohortLoan = {
  /** Calendar day the application started; null while the loan is still a lead. */
  applicationDate: string | null;
  fundedAt: Date | null;
};

export type PullThrough = {
  cohort: number;
  funded: number;
  /** Whole percent, or null when the cohort is empty — a rate over nothing is not 0 %. */
  percent: number | null;
};

/** Whole days between a calendar date and `now`, read at noon UTC so no offset shifts it. */
function daysAgo(date: string, now: Date): number {
  return -daysUntil(date, now);
}

/**
 * Pull-through the way the industry measures it (the ICE cohort method): of the
 * applications started 60–180 days ago, how many funded.
 *
 * The window looks backwards on purpose. Applications younger than 60 days have not had
 * time to close, so counting them would drag the rate down and make a healthy pipeline
 * look broken; anything older than 180 days is no longer this pipeline.
 */
export function pullThrough(
  loans: readonly CohortLoan[],
  now: Date = new Date(),
): PullThrough {
  let cohort = 0;
  let funded = 0;
  for (const loan of loans) {
    if (!loan.applicationDate) continue;
    const age = daysAgo(loan.applicationDate, now);
    if (age < PULL_THROUGH_WINDOW.newest || age > PULL_THROUGH_WINDOW.oldest) {
      continue;
    }
    cohort += 1;
    if (loan.fundedAt) funded += 1;
  }
  return {
    cohort,
    funded,
    percent: cohort === 0 ? null : Math.round((funded / cohort) * 100),
  };
}

/**
 * Mean days from application to funding over the loans funded in the last 90 days, or
 * null when none have. Recent closings only: a cycle time that averages in last year's
 * loans describes a team that no longer exists.
 */
export function avgCycleTimeDays(
  loans: readonly CohortLoan[],
  now: Date = new Date(),
): number | null {
  let total = 0;
  let counted = 0;
  for (const loan of loans) {
    if (!loan.fundedAt || !loan.applicationDate) continue;
    if (daysSince(loan.fundedAt, now) > CYCLE_TIME_WINDOW_DAYS) continue;
    const started = new Date(`${loan.applicationDate}T12:00:00Z`);
    total += Math.round((loan.fundedAt.getTime() - started.getTime()) / DAY_MS);
    counted += 1;
  }
  return counted === 0 ? null : Math.round(total / counted);
}

/**
 * Midnight UTC on the first of the month `now` falls in, or `offset` months from it
 * (-1 for last month). The month boundary is UTC everywhere, so "funded this month"
 * means the same thing to the query, the test and the person counting by hand.
 */
export function startOfUtcMonth(now: Date = new Date(), offset = 0): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1),
  );
}
