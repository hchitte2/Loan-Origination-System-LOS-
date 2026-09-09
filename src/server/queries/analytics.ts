import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { loans } from "@/db/schema";
import {
  type Attention,
  avgCycleTimeDays,
  dashboardAttention,
  type PullThrough,
  pullThrough,
  startOfUtcMonth,
} from "@/lib/analytics-math";
import { daysSince } from "@/lib/format";
import {
  ACTIVE_STAGES,
  type ActiveStage,
  isActiveStage,
  type Stage,
} from "@/lib/stages";
import type { Actor } from "../actor";
import { assertCan, loanScope } from "../authz";
import { familyName } from "./loans";

/**
 * Everything the dashboard draws (PLAN.md §7), from one pass over the loans the actor is
 * allowed to read.
 *
 * One query rather than six: the whole demo is a few dozen loans, and every tile on the
 * screen has to reconcile with every other one. Six queries against a table that can
 * change between them would let the tiles disagree, which on a screen whose entire job is
 * to be trusted is worse than any amount of saved work. The formulas themselves live in
 * `lib/analytics-math.ts`, tested against fixed rows.
 *
 * `mine` is a filter, not a permission — `loan.read` is `any` for all three staff roles,
 * so the loan officer's dashboard narrows to their own files the same way the pipeline's
 * "Mine" toggle does.
 */

export type StageSlice = {
  stage: ActiveStage;
  count: number;
  amount: number;
};

export type AttentionRow = {
  id: string;
  familyName: string;
  propertyStreet: string;
  stage: ActiveStage;
  daysInStage: number;
  targetCloseDate: string | null;
  reason: Attention;
};

export type DashboardData = {
  /** Count and dollars across the six active stages. */
  activePipeline: { count: number; amount: number };
  fundedThisMonth: {
    count: number;
    amount: number;
    /** "Rivera · Sandoval" on the loan officer's tile. */
    familyNames: string[];
    /** Last month's count, for the delta line. */
    previousCount: number;
  };
  pullThrough: PullThrough;
  /** Mean days application → funding over the last 90 days, or null if none funded. */
  cycleTimeDays: number | null;
  /** All six stages, in pipeline order, zeroes included so the chart keeps its shape. */
  byStage: StageSlice[];
  /** Active loans wanting attention, worst first. */
  attention: AttentionRow[];
  /** The subset closing inside 14 days, for the loan officer's third tile. */
  closingSoon: AttentionRow[];
};

/** Stalled files outrank approaching close dates, then the longest wait leads. */
const REASON_ORDER = { stalled: 0, closing_soon: 1, needs_review: 2 } as const;

function worseFirst(a: AttentionRow, b: AttentionRow): number {
  const byKind = REASON_ORDER[a.reason.kind] - REASON_ORDER[b.reason.kind];
  if (byKind !== 0) return byKind;
  return b.daysInStage - a.daysInStage;
}

export async function getDashboardData(
  actor: Actor,
  options: { mine?: boolean } = {},
  now: Date = new Date(),
): Promise<DashboardData> {
  assertCan(actor, "analytics.view");

  // PLAN.md §2 gives a loan officer `own` analytics. It cannot be an `"own"` POLICY cell,
  // because those resolve against a loan and a dashboard has none, so the scope is decided
  // here rather than by the caller: `getDashboardData(actor)` must not hand a loan officer
  // the firm's numbers because a page forgot to ask. `options.mine` only overrides it.
  const mine = options.mine ?? actor.role === "loan_officer";

  const rows = await db()
    .select({
      id: loans.id,
      borrowerName: loans.borrowerName,
      propertyStreet: loans.propertyStreet,
      stage: loans.stage,
      stageEnteredAt: loans.stageEnteredAt,
      applicationDate: loans.applicationDate,
      amount: loans.amount,
      targetCloseDate: loans.targetCloseDate,
      fundedAt: loans.fundedAt,
    })
    .from(loans)
    .where(
      and(
        loanScope(actor, "read"),
        mine ? eq(loans.loanOfficerId, actor.userId) : undefined,
      ),
    );

  const monthStart = startOfUtcMonth(now);
  const previousMonthStart = startOfUtcMonth(now, -1);

  const byStage: StageSlice[] = ACTIVE_STAGES.map((stage) => ({
    stage,
    count: 0,
    amount: 0,
  }));
  const stageIndexOf = new Map<Stage, number>(
    ACTIVE_STAGES.map((stage, index) => [stage, index]),
  );

  let activeCount = 0;
  let activeAmount = 0;
  let fundedCount = 0;
  let fundedAmount = 0;
  let previousCount = 0;
  const fundedNames: string[] = [];
  const attention: AttentionRow[] = [];

  for (const row of rows) {
    if (isActiveStage(row.stage)) {
      activeCount += 1;
      activeAmount += row.amount;
      const slice = byStage[stageIndexOf.get(row.stage) ?? -1];
      if (slice) {
        slice.count += 1;
        slice.amount += row.amount;
      }

      const reason = dashboardAttention(
        {
          stage: row.stage,
          stageEnteredAt: row.stageEnteredAt,
          targetCloseDate: row.targetCloseDate,
        },
        now,
      );
      if (reason) {
        attention.push({
          id: row.id,
          familyName: familyName(row.borrowerName),
          propertyStreet: row.propertyStreet,
          stage: row.stage,
          daysInStage: daysSince(row.stageEnteredAt, now),
          targetCloseDate: row.targetCloseDate,
          reason,
        });
      }
    }

    if (row.fundedAt && row.fundedAt >= monthStart) {
      fundedCount += 1;
      fundedAmount += row.amount;
      fundedNames.push(familyName(row.borrowerName));
    } else if (
      row.fundedAt &&
      row.fundedAt >= previousMonthStart &&
      row.fundedAt < monthStart
    ) {
      previousCount += 1;
    }
  }

  attention.sort(worseFirst);

  return {
    activePipeline: { count: activeCount, amount: activeAmount },
    fundedThisMonth: {
      count: fundedCount,
      amount: fundedAmount,
      familyNames: fundedNames.sort((a, b) => a.localeCompare(b)),
      previousCount,
    },
    pullThrough: pullThrough(rows, now),
    cycleTimeDays: avgCycleTimeDays(rows, now),
    byStage,
    attention,
    closingSoon: attention.filter((row) => row.reason.kind === "closing_soon"),
  };
}
