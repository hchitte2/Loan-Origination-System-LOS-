import { describe, expect, it } from "vitest";
import {
  type AttentionInput,
  attentionsFor,
  CLOSING_SOON_DAYS,
  primaryAttention,
  STALLED_AFTER_DAYS,
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
