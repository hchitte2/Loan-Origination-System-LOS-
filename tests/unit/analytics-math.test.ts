import { describe, expect, it } from "vitest";
import {
  type AttentionInput,
  agingBuckets,
  attentionReason,
  attentionsFor,
  avgCycleTimeDays,
  CLOSING_SOON_DAYS,
  type CohortLoan,
  dashboardAttention,
  primaryAttention,
  pullThrough,
  STALLED_AFTER_DAYS,
  startOfUtcMonth,
} from "../../src/lib/analytics-math";
import type { Stage } from "../../src/lib/stages";

/**
 * The "needs attention" rule (PLAN.md §7). Dates are pinned: `NOW` is the only clock, and
 * every fixture is expressed as days before or after it.
 */
const NOW = new Date("2026-09-08T15:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

function calendarDaysFromNow(days: number): string {
  const date = new Date(NOW.getTime() + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function loan(overrides: Partial<AttentionInput> = {}): AttentionInput {
  return {
    stage: "processing",
    stageEnteredAt: daysAgo(1),
    targetCloseDate: null,
    pendingDocuments: 0,
    ...overrides,
  };
}

describe("attentionsFor", () => {
  it("says nothing about a healthy file", () => {
    expect(attentionsFor(loan(), NOW)).toEqual([]);
  });

  it("flags a document waiting on a reviewer", () => {
    expect(attentionsFor(loan({ pendingDocuments: 2 }), NOW)).toEqual([
      { kind: "needs_review", pendingDocuments: 2 },
    ]);
  });

  it.each(
    Object.entries(STALLED_AFTER_DAYS) as [
      keyof typeof STALLED_AFTER_DAYS,
      number,
    ][],
  )("flags %s as stalled only past %i days", (stage, threshold) => {
    const at = (days: number) =>
      attentionsFor(loan({ stage, stageEnteredAt: daysAgo(days) }), NOW);
    expect(at(threshold)).toEqual([]);
    expect(at(threshold + 1)).toEqual([
      { kind: "stalled", stage, days: threshold + 1 },
    ]);
  });

  it("never calls lead or application stalled, however long they sit", () => {
    for (const stage of ["lead", "application"] as const) {
      expect(
        attentionsFor(loan({ stage, stageEnteredAt: daysAgo(60) }), NOW),
      ).toEqual([]);
    }
  });

  it("flags a close date inside the window", () => {
    expect(
      attentionsFor(
        loan({ targetCloseDate: calendarDaysFromNow(CLOSING_SOON_DAYS) }),
        NOW,
      ),
    ).toEqual([{ kind: "closing_soon", days: CLOSING_SOON_DAYS }]);
    expect(
      attentionsFor(
        loan({ targetCloseDate: calendarDaysFromNow(CLOSING_SOON_DAYS + 1) }),
        NOW,
      ),
    ).toEqual([]);
  });

  it("does not call a clear-to-close file closing soon; it is already there", () => {
    expect(
      attentionsFor(
        loan({
          stage: "clear_to_close",
          targetCloseDate: calendarDaysFromNow(3),
        }),
        NOW,
      ),
    ).toEqual([]);
  });

  it("ignores a target close date that has already passed", () => {
    expect(
      attentionsFor(loan({ targetCloseDate: calendarDaysFromNow(-1) }), NOW),
    ).toEqual([]);
  });

  it.each(["funded", "withdrawn", "denied"] as Stage[])(
    "says nothing about a %s loan",
    (stage) => {
      expect(
        attentionsFor(
          loan({
            stage,
            stageEnteredAt: daysAgo(90),
            pendingDocuments: 3,
            targetCloseDate: calendarDaysFromNow(2),
          }),
          NOW,
        ),
      ).toEqual([]);
    },
  );

  it("ranks a stalled clock above a reviewable document and a close date", () => {
    const busy = loan({
      stageEnteredAt: daysAgo(STALLED_AFTER_DAYS.processing + 2),
      pendingDocuments: 1,
      targetCloseDate: calendarDaysFromNow(3),
    });
    expect(attentionsFor(busy, NOW).map((a) => a.kind)).toEqual([
      "stalled",
      "needs_review",
      "closing_soon",
    ]);
    expect(primaryAttention(busy, NOW)).toEqual({
      kind: "stalled",
      stage: "processing",
      days: STALLED_AFTER_DAYS.processing + 2,
    });
  });

  it("shows a reviewable document ahead of a close date when nothing is stalled", () => {
    const kim = loan({
      stageEnteredAt: daysAgo(3),
      pendingDocuments: 1,
      targetCloseDate: calendarDaysFromNow(7),
    });
    expect(primaryAttention(kim, NOW)).toEqual({
      kind: "needs_review",
      pendingDocuments: 1,
    });
  });

  it("has no primary reason when nothing is wrong", () => {
    expect(primaryAttention(loan(), NOW)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------
// Dashboard formulas (PLAN.md §7 "Definitions")
// ---------------------------------------------------------------------------------------

describe("agingBuckets", () => {
  it("puts each age in the bucket whose upper edge it reaches first", () => {
    const ages = [0, 3, 4, 7, 8, 14, 15, 400].map(daysAgo);
    expect(agingBuckets(ages, NOW)).toEqual([
      { label: "0–3 d", count: 2 },
      { label: "4–7 d", count: 2 },
      { label: "8–14 d", count: 2 },
      { label: "15+ d", count: 2 },
    ]);
  });

  it("returns every bucket at zero rather than an empty list", () => {
    expect(agingBuckets([], NOW).map((bucket) => bucket.count)).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

describe("pullThrough", () => {
  function applied(daysBefore: number, funded: boolean): CohortLoan {
    return {
      applicationDate: calendarDaysFromNow(-daysBefore),
      fundedAt: funded ? daysAgo(1) : null,
    };
  }

  it("counts funded over the applications started 60 to 180 days ago", () => {
    const rows = [
      applied(70, true),
      applied(90, true),
      applied(120, true),
      applied(150, false),
    ];
    expect(pullThrough(rows, NOW)).toEqual({
      cohort: 4,
      funded: 3,
      percent: 75,
    });
  });

  it("includes both edges of the window and excludes just outside it", () => {
    const rows = [
      applied(60, true),
      applied(180, true),
      applied(59, false),
      applied(181, false),
    ];
    expect(pullThrough(rows, NOW)).toMatchObject({ cohort: 2, funded: 2 });
  });

  it("ignores loans that never reached application", () => {
    const rows: CohortLoan[] = [
      { applicationDate: null, fundedAt: null },
      applied(90, true),
    ];
    expect(pullThrough(rows, NOW)).toMatchObject({ cohort: 1, funded: 1 });
  });

  it("has no percentage at all when the cohort is empty", () => {
    // A rate over nothing is not 0 %; the tile shows an em dash instead.
    expect(pullThrough([], NOW)).toEqual({
      cohort: 0,
      funded: 0,
      percent: null,
    });
  });
});

describe("avgCycleTimeDays", () => {
  function fundedLoan(appliedDaysAgo: number, fundedDaysAgo: number) {
    return {
      applicationDate: calendarDaysFromNow(-appliedDaysAgo),
      fundedAt: daysAgo(fundedDaysAgo),
    };
  }

  it("averages application to funding over the loans funded in the last 90 days", () => {
    const rows = [fundedLoan(40, 10), fundedLoan(50, 10)];
    expect(avgCycleTimeDays(rows, NOW)).toBe(35);
  });

  it("ignores loans funded before the window and loans still open", () => {
    const rows = [
      fundedLoan(40, 10),
      fundedLoan(400, 91),
      { applicationDate: calendarDaysFromNow(-20), fundedAt: null },
    ];
    expect(avgCycleTimeDays(rows, NOW)).toBe(30);
  });

  it("is null when nothing funded in the window", () => {
    expect(avgCycleTimeDays([], NOW)).toBeNull();
  });
});

describe("startOfUtcMonth", () => {
  it("returns midnight UTC on the first of the month", () => {
    expect(startOfUtcMonth(NOW).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("steps back across a year boundary", () => {
    const january = new Date("2026-01-14T09:00:00Z");
    expect(startOfUtcMonth(january, -1).toISOString()).toBe(
      "2025-12-01T00:00:00.000Z",
    );
  });
});

describe("dashboardAttention", () => {
  it("ignores documents waiting on review — that is the queue's job", () => {
    const busy = {
      stage: "processing" as Stage,
      stageEnteredAt: daysAgo(2),
      targetCloseDate: null,
    };
    expect(dashboardAttention(busy, NOW)).toBeNull();
  });

  it("still reports a stalled file and a close date coming up", () => {
    expect(
      dashboardAttention(
        {
          stage: "processing",
          stageEnteredAt: daysAgo(STALLED_AFTER_DAYS.processing + 2),
          targetCloseDate: null,
        },
        NOW,
      ),
    ).toEqual({
      kind: "stalled",
      stage: "processing",
      days: STALLED_AFTER_DAYS.processing + 2,
    });

    expect(
      dashboardAttention(
        {
          stage: "processing",
          stageEnteredAt: daysAgo(1),
          targetCloseDate: calendarDaysFromNow(9),
        },
        NOW,
      ),
    ).toEqual({ kind: "closing_soon", days: 9 });
  });
});

describe("attentionReason", () => {
  it("says why, in the words the design frame uses", () => {
    expect(
      attentionReason({ kind: "stalled", stage: "processing", days: 12 }),
    ).toBe("Stalled 12 d in Processing");
    expect(
      attentionReason({
        kind: "stalled",
        stage: "conditional_approval",
        days: 9,
      }),
    ).toBe("Stalled 9 d in Conditional approval");
    expect(attentionReason({ kind: "closing_soon", days: 9 })).toBe(
      "Closing in 9 d, not yet clear to close",
    );
  });
});
