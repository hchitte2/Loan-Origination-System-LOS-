import { describe, expect, it } from "vitest";
import { formatAge, formatFileSize } from "@/lib/format";

/**
 * The two formatters this phase adds. The rest of `format.ts` predates it and is
 * exercised through the screens that use it.
 */

describe("formatFileSize", () => {
  it("counts bytes below a kilobyte", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(812)).toBe("812 B");
    expect(formatFileSize(999)).toBe("999 B");
  });

  it("switches to kilobytes at 1000, the way a file manager does", () => {
    expect(formatFileSize(1000)).toBe("1 KB");
    expect(formatFileSize(184_302)).toBe("184 KB");
  });

  it("switches to megabytes with one decimal", () => {
    expect(formatFileSize(1_000_000)).toBe("1.0 MB");
    expect(formatFileSize(1_200_000)).toBe("1.2 MB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10.5 MB");
  });
});

describe("formatAge", () => {
  const NOW = new Date("2026-09-08T15:00:00.000Z");

  it("counts minutes in the first hour", () => {
    expect(formatAge(new Date("2026-09-08T14:58:00.000Z"), NOW)).toBe("2 m");
    expect(formatAge(NOW, NOW)).toBe("0 m");
  });

  it("switches to hours at the hour", () => {
    expect(formatAge(new Date("2026-09-08T14:00:00.000Z"), NOW)).toBe("1 h");
    expect(formatAge(new Date("2026-09-08T09:00:00.000Z"), NOW)).toBe("6 h");
  });

  it("switches to days at a day", () => {
    expect(formatAge(new Date("2026-09-07T15:00:00.000Z"), NOW)).toBe("1 d");
    expect(formatAge(new Date("2026-09-06T15:00:00.000Z"), NOW)).toBe("2 d");
  });

  it("never reads as negative when a clock is a little ahead", () => {
    expect(formatAge(new Date("2026-09-08T15:00:30.000Z"), NOW)).toBe("0 m");
  });
});
