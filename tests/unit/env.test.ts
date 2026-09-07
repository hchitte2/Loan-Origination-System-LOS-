import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const valid = {
  DATABASE_URL:
    "postgresql://user:pass@ep-quiet-forest-123456.us-east-2.aws.neon.tech/neondb",
  BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_example",
  CRON_SECRET: "0123456789abcdef",
  DEMO_PASSWORD: "demo-password",
  DEMO_SHOWCASE_TOKEN: "0123456789abcdef",
};

describe("parseEnv", () => {
  it("accepts a complete environment", () => {
    const env = parseEnv(valid);
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(env.VERCEL).toBeUndefined();
  });

  it("reports every missing key by name and never a value", () => {
    expect(() => parseEnv({})).toThrowError(
      /DATABASE_URL[\s\S]*DEMO_SHOWCASE_TOKEN/,
    );
    expect(() =>
      parseEnv({ ...valid, DATABASE_URL: undefined }),
    ).not.toThrowError(/pass@/);
  });

  it("rejects a DATABASE_URL that is not a postgres URL", () => {
    expect(() =>
      parseEnv({ ...valid, DATABASE_URL: "https://example.com" }),
    ).toThrowError(/DATABASE_URL/);
  });

  it("keeps the VERCEL marker when the platform sets it", () => {
    expect(parseEnv({ ...valid, VERCEL: "1" }).VERCEL).toBe("1");
  });
});
