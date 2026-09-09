import { expect, type Page } from "@playwright/test";
import { fixtureLoans, SHOWCASE_LOAN_KEY } from "../../../src/db/seed";

/**
 * The showcase loan, as the fixture declares it — specs read facts from `seed.ts` rather
 * than carrying magic strings (`.claude/rules/testing.md`).
 */
export const SHOWCASE = (() => {
  const loan = fixtureLoans().find((l) => l.key === SHOWCASE_LOAN_KEY);
  if (!loan) throw new Error(`No fixture loan keyed ${SHOWCASE_LOAN_KEY}`);
  return loan;
})();

/** "Maria Chen" → "Chen": what the board card and the loan heading show. */
export function familyName(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

/**
 * Open a loan by finding it on the pipeline list, which is how a person reaches it. The
 * id is a uuid the seed does not export, so the link is the honest way in.
 */
export async function openLoanFromPipeline(
  page: Page,
  street: string,
): Promise<string> {
  await page.goto("/pipeline?view=list");
  const row = page.getByRole("row").filter({ hasText: street });
  await expect(row).toBeVisible();
  await row.getByRole("link").first().click();
  await page.waitForURL(/\/loans\/[0-9a-f-]{36}/);
  return new URL(page.url()).pathname;
}

/**
 * The showcase loan's public token. Specs read it from the environment rather than the
 * fixture, because the seed derives it from `DEMO_SHOWCASE_TOKEN` — the one place both
 * the app and the tests agree on it.
 */
export function showcaseToken(): string {
  const token = process.env.DEMO_SHOWCASE_TOKEN;
  if (!token) {
    throw new Error(
      "DEMO_SHOWCASE_TOKEN is not set. Playwright reads it from .env.local.",
    );
  }
  return token;
}
