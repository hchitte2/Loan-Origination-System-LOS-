import { describe, expect, it } from "vitest";
import {
  CONDITION_STATUSES,
  type ConditionStatus,
  canClear,
  canDelete,
  statusAfterRejection,
  statusAfterUpload,
} from "@/lib/conditions";

/**
 * PLAN.md §6 invariants 3 and 9, as decisions over a status and one fact. Every status is
 * walked rather than only the interesting one, so a new status cannot be added without
 * saying what these rules do with it.
 */

const OTHERS = (except: ConditionStatus) =>
  CONDITION_STATUSES.filter((s) => s !== except);

describe("statusAfterUpload", () => {
  it("moves a requested condition to received", () => {
    expect(statusAfterUpload("requested")).toBe("received");
  });

  it("leaves every other status alone", () => {
    for (const status of OTHERS("requested")) {
      expect(statusAfterUpload(status)).toBeNull();
    }
  });

  it("does not re-announce a condition that is already received", () => {
    // A second pay stub onto an item under review is not news.
    expect(statusAfterUpload("received")).toBeNull();
  });

  it("does not reopen a settled condition", () => {
    expect(statusAfterUpload("cleared")).toBeNull();
    expect(statusAfterUpload("waived")).toBeNull();
  });
});

describe("statusAfterRejection", () => {
  it("reopens a received condition when nothing accepted is left", () => {
    expect(statusAfterRejection("received", false)).toBe("requested");
  });

  it("leaves it answered while another accepted document stands", () => {
    // An accepted pay stub plus a rejected duplicate is still answered.
    expect(statusAfterRejection("received", true)).toBeNull();
    for (const status of CONDITION_STATUSES) {
      expect(statusAfterRejection(status, true)).toBeNull();
    }
  });

  it("reopens a cleared condition when its last accepted document is rejected", () => {
    // Clearing rests on an accepted document. Taking that away takes away what the
    // clearance stood on, so the borrower is asked again.
    expect(statusAfterRejection("cleared", false)).toBe("requested");
  });

  it("leaves a waived condition waived", () => {
    // It was closed on a decision, not on a document, so no document changes it.
    expect(statusAfterRejection("waived", false)).toBeNull();
  });

  it("changes nothing on a condition that was never answered", () => {
    expect(statusAfterRejection("requested", false)).toBeNull();
  });
});

describe("canClear", () => {
  it("needs an accepted document, whatever the status", () => {
    expect(canClear("received", true)).toBe(true);
    expect(canClear("received", false)).toBe(false);
    expect(canClear("requested", false)).toBe(false);
  });

  it("allows clearing a requested condition that has an accepted document", () => {
    // A rejection can push a condition back to requested while an older accepted
    // document is still on it; the reviewer may still close it.
    expect(canClear("requested", true)).toBe(true);
  });

  it("refuses a condition that is already settled", () => {
    expect(canClear("cleared", true)).toBe(false);
    expect(canClear("waived", true)).toBe(false);
  });
});

describe("canDelete (PLAN.md §6 invariant 9)", () => {
  it("allows deleting an untouched request", () => {
    expect(canDelete("requested", 0)).toBe(true);
  });

  it("refuses once any document has been hung on it, even a rejected one", () => {
    expect(canDelete("requested", 1)).toBe(false);
    expect(canDelete("requested", 7)).toBe(false);
  });

  it("refuses every status past requested, document or not", () => {
    for (const status of OTHERS("requested")) {
      expect(canDelete(status, 0)).toBe(false);
      expect(canDelete(status, 3)).toBe(false);
    }
  });
});
