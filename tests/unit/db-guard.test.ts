import { describe, expect, it } from "vitest";
import { hostKey, isProductionHost, parseProdHostFile } from "@/db/guard";

const prodHost = "ep-quiet-forest-123456.us-east-2.aws.neon.tech";
const devUrl =
  "postgresql://u:p@ep-cool-lake-654321.us-east-2.aws.neon.tech/neondb";

describe("parseProdHostFile", () => {
  it("ignores comments, blank lines and surrounding whitespace", () => {
    const text = `# comment\n\n  ${prodHost}  \n#another\nlocalhost\n`;
    expect(parseProdHostFile(text)).toEqual([prodHost, "localhost"]);
  });
});

describe("hostKey", () => {
  it("reduces a Neon hostname to its endpoint id, dropping -pooler", () => {
    expect(hostKey(prodHost)).toBe("ep-quiet-forest-123456");
    expect(
      hostKey("ep-quiet-forest-123456-pooler.us-east-2.aws.neon.tech"),
    ).toBe("ep-quiet-forest-123456");
  });

  it("keeps a non-Neon hostname whole", () => {
    expect(hostKey("db.example.com")).toBe("db.example.com");
  });
});

describe("isProductionHost", () => {
  it("matches the direct and pooler hostnames, case-insensitively", () => {
    expect(
      isProductionHost(`postgresql://u:p@${prodHost}/neondb`, [prodHost]),
    ).toBe(true);
    expect(
      isProductionHost(
        "postgresql://u:p@EP-QUIET-FOREST-123456-POOLER.us-east-2.aws.neon.tech/neondb",
        [prodHost],
      ),
    ).toBe(true);
  });

  it("lets the dev branch and localhost through", () => {
    expect(isProductionHost(devUrl, [prodHost])).toBe(false);
    expect(
      isProductionHost("postgresql://u:p@localhost:5432/clearline", [prodHost]),
    ).toBe(false);
  });

  it("never matches when no production host is configured", () => {
    expect(isProductionHost(`postgresql://u:p@${prodHost}/neondb`, [])).toBe(
      false,
    );
  });
});
