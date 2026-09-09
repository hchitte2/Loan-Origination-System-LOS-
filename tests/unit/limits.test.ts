import { describe, expect, it } from "vitest";
import {
  ALLOWED_CONTENT_TYPES,
  fileRejection,
  MAX_FILE_BYTES,
} from "@/lib/uploads";
import {
  CAP_REACHED,
  DAILY_LOAN_CAP,
  DAILY_UPLOAD_CAP,
  loanCapReached,
  PER_LOAN_UPLOAD_CAP,
  startOfUtcDay,
  uploadCapReached,
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

describe("fileRejection", () => {
  const ok = 2 * 1024 * 1024;

  it("accepts the three types a mortgage file arrives as", () => {
    for (const type of ALLOWED_CONTENT_TYPES) {
      expect(fileRejection(type, ok)).toBeNull();
    }
  });

  it("refuses anything else, and says what to send instead", () => {
    for (const type of [
      "application/x-msdownload",
      "application/zip",
      "text/html",
      "image/svg+xml",
      "",
    ]) {
      expect(fileRejection(type, ok)).toBe(
        "That kind of file will not open on our side. Send a PDF, JPG or PNG.",
      );
    }
  });

  it("accepts a file of exactly the maximum size", () => {
    expect(fileRejection("application/pdf", MAX_FILE_BYTES)).toBeNull();
  });

  it("refuses one byte over, and names the limit", () => {
    expect(fileRejection("application/pdf", MAX_FILE_BYTES + 1)).toBe(
      "That file is too large. Keep it under 10 MB and try again.",
    );
  });

  it("refuses an empty file rather than storing nothing", () => {
    expect(fileRejection("application/pdf", 0)).not.toBeNull();
  });

  it("checks the type before the size, so an .exe is never called too large", () => {
    expect(fileRejection("application/x-msdownload", MAX_FILE_BYTES * 3)).toBe(
      "That kind of file will not open on our side. Send a PDF, JPG or PNG.",
    );
  });

  it("caps a file at 10 MB", () => {
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("uploadCapReached", () => {
  it("allows an upload while both counts have room", () => {
    expect(uploadCapReached({ forLoan: 0, forDay: 0 })).toBe(false);
    expect(
      uploadCapReached({
        forLoan: PER_LOAN_UPLOAD_CAP - 1,
        forDay: DAILY_UPLOAD_CAP - 1,
      }),
    ).toBe(false);
  });

  it("refuses when one loan has had its fill, even on a quiet day", () => {
    expect(uploadCapReached({ forLoan: PER_LOAN_UPLOAD_CAP, forDay: 0 })).toBe(
      true,
    );
  });

  it("refuses when the day is spent, even on an untouched loan", () => {
    expect(uploadCapReached({ forLoan: 0, forDay: DAILY_UPLOAD_CAP })).toBe(
      true,
    );
  });

  it("caps a loan at 10 a day and the demo at 40", () => {
    expect(PER_LOAN_UPLOAD_CAP).toBe(10);
    expect(DAILY_UPLOAD_CAP).toBe(40);
  });
});

describe("CAP_REACHED", () => {
  it("reads as a limit, not as a failure", () => {
    expect(CAP_REACHED).toBe("Demo limit reached, try again tomorrow");
  });
});
