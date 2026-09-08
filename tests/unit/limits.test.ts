import { describe, expect, it } from "vitest";
import {
  CAP_REACHED,
  DAILY_LOAN_CAP,
  loanCapReached,
  startOfUtcDay,
} from "@/server/limits";

/**
 * The caps from PLAN.md §5. Each decision is a pure function over a count, so the
 * boundary — the last allowed row and the first refused one — is checked here rather
 * than by creating thirty loans against a database.
 */

describe("startOfUtcDay", () => {
  it("returns midnight UTC of the day the instant falls in", () => {
    expect(startOfUtcDay(new Date("2026-09-08T15:42:07.913Z"))).toEqual(
      new Date("2026-09-08T00:00:00.000Z"),
    );
  });

  it("is idempotent on a midnight that is already the boundary", () => {
    const midnight = new Date("2026-09-08T00:00:00.000Z");
    expect(startOfUtcDay(midnight)).toEqual(midnight);
  });

  it("uses UTC, not the machine's timezone", () => {
    // 23:30 in Austin on Sep 8 is 04:30 UTC on Sep 9: the window that matters is the
    // UTC one, so a late-evening US visitor counts against the next day's cap.
    expect(startOfUtcDay(new Date("2026-09-09T04:30:00.000Z"))).toEqual(
      new Date("2026-09-09T00:00:00.000Z"),
    );
  });

  it("does not carry the wall-clock time into the boundary", () => {
    const boundary = startOfUtcDay(new Date("2026-09-08T23:59:59.999Z"));
    expect(boundary.getUTCHours()).toBe(0);
    expect(boundary.getUTCMinutes()).toBe(0);
    expect(boundary.getUTCSeconds()).toBe(0);
    expect(boundary.getUTCMilliseconds()).toBe(0);
  });
});

describe("loanCapReached", () => {
  it("allows the first loan of the day", () => {
    expect(loanCapReached(0)).toBe(false);
  });

  it("allows the last loan the cap permits", () => {
    // With 29 already created, the 30th is the one being asked for.
    expect(loanCapReached(DAILY_LOAN_CAP - 1)).toBe(false);
  });

  it("refuses once the cap is full", () => {
    expect(loanCapReached(DAILY_LOAN_CAP)).toBe(true);
  });

  it("stays refused past the cap", () => {
    expect(loanCapReached(DAILY_LOAN_CAP + 12)).toBe(true);
  });

  it("caps the day at 30 loans", () => {
    expect(DAILY_LOAN_CAP).toBe(30);
  });
});

describe("CAP_REACHED", () => {
  it("reads as a limit, not as a failure", () => {
    expect(CAP_REACHED).toBe("Demo limit reached, try again tomorrow");
  });
});
