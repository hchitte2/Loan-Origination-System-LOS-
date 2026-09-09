import { expect, test } from "@playwright/test";

/**
 * The two headers every response carries (PLAN.md §5). Worth a test because they live in
 * `next.config.ts`, far from any screen: nothing else fails if they quietly stop being
 * sent, and a demo that gets indexed or framed is the exact thing they prevent.
 */
const PATHS = [
  ["/login", 200],
  ["/u/a-token-that-does-not-exist", 200],
  ["/api/cron/reset", 401],
] as const;

for (const [path, status] of PATHS) {
  test(`${path} is noindex and cannot be framed`, async ({ request }) => {
    const response = await request.get(path, { failOnStatusCode: false });
    expect(response.status()).toBe(status);
    const headers = response.headers();
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(headers["content-security-policy"]).toBe("frame-ancestors 'none'");
  });
}
