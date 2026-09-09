import { describe, expect, it } from "vitest";
import {
  blobPathnameFor,
  isInLoanPrefix,
  SEED_PREFIX,
  safeFileName,
  uploadPrefix,
} from "@/lib/uploads";

/**
 * The pathname is the security boundary of the upload route: the browser proposes it, so
 * everything here is written against a caller trying to escape one loan's folder.
 */

const LOAN = "0dea2eac-7e8b-5465-aac5-428e7f613e3e";
const OTHER = "9de03510-f3ca-5da5-907f-af61c74cd82f";

describe("uploadPrefix", () => {
  it("gives each loan its own folder under uploads/", () => {
    expect(uploadPrefix(LOAN)).toBe(`uploads/${LOAN}/`);
  });

  it("never collides with the seed specimens the reset must not delete", () => {
    expect(uploadPrefix(LOAN).startsWith(SEED_PREFIX)).toBe(false);
  });
});

describe("isInLoanPrefix", () => {
  it("accepts a file directly inside the loan's folder", () => {
    expect(isInLoanPrefix(`uploads/${LOAN}/w2-2025.pdf`, LOAN)).toBe(true);
  });

  it("refuses another loan's folder", () => {
    expect(isInLoanPrefix(`uploads/${OTHER}/w2-2025.pdf`, LOAN)).toBe(false);
  });

  it("refuses a path that climbs out with ..", () => {
    expect(isInLoanPrefix(`uploads/${LOAN}/../${OTHER}/w2.pdf`, LOAN)).toBe(
      false,
    );
    expect(isInLoanPrefix(`uploads/${LOAN}/..`, LOAN)).toBe(false);
  });

  it("refuses an empty segment that could normalise elsewhere", () => {
    expect(isInLoanPrefix(`uploads/${LOAN}//w2.pdf`, LOAN)).toBe(false);
  });

  it("refuses a subfolder, so nothing can hide below a recorded pathname", () => {
    // The nightly reset deletes the pathnames in documents.blob_pathname. A file one
    // level deeper would never be recorded, and so would survive every reset.
    expect(isInLoanPrefix(`uploads/${LOAN}/nested/w2.pdf`, LOAN)).toBe(false);
  });

  it("refuses the bare prefix with no file", () => {
    expect(isInLoanPrefix(uploadPrefix(LOAN), LOAN)).toBe(false);
  });

  it("refuses the seed folder, whoever asks", () => {
    expect(isInLoanPrefix("seed/specimen-w2.pdf", LOAN)).toBe(false);
  });

  it("refuses a loan id that is merely a prefix of the folder name", () => {
    // "uploads/<loan>extra/" must not pass for "<loan>".
    expect(isInLoanPrefix(`uploads/${LOAN}extra/w2.pdf`, LOAN)).toBe(false);
  });
});

describe("safeFileName", () => {
  it("keeps an ordinary name unchanged", () => {
    expect(safeFileName("w2-2025.pdf")).toBe("w2-2025.pdf");
  });

  it("flattens separators so a name cannot become a path", () => {
    // Separators go first, then the leading dots of what is left.
    expect(safeFileName("../../etc/passwd")).toBe("-..-etc-passwd");
    expect(safeFileName("a\\b.pdf")).toBe("a-b.pdf");
  });

  it("strips control characters that would split a header", () => {
    expect(safeFileName("w2\r\nContent-Type: text/html.pdf")).toBe(
      "w2Content-Type: text-html.pdf",
    );
  });

  it("drops leading dots so nothing becomes a hidden file", () => {
    expect(safeFileName("...hidden.pdf")).toBe("hidden.pdf");
  });

  it("falls back to a usable name when nothing survives", () => {
    expect(safeFileName("   ")).toBe("document");
    expect(safeFileName("...")).toBe("document");
  });

  it("truncates a very long name from the front, keeping the extension", () => {
    const long = `${"a".repeat(300)}.pdf`;
    const result = safeFileName(long);
    expect(result).toHaveLength(120);
    expect(result.endsWith(".pdf")).toBe(true);
  });
});

describe("blobPathnameFor", () => {
  it("puts the sanitised name inside the loan's folder", () => {
    expect(blobPathnameFor(LOAN, "w2-2025.pdf")).toBe(
      `uploads/${LOAN}/w2-2025.pdf`,
    );
  });

  it("produces a pathname its own prefix check accepts", () => {
    for (const name of ["w2.pdf", "../escape.pdf", "a/b/c.pdf", "   ", "..."]) {
      expect(isInLoanPrefix(blobPathnameFor(LOAN, name), LOAN)).toBe(true);
    }
  });
});
