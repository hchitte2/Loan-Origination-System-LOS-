import { expect, test } from "@playwright/test";
import { enterAs } from "./helpers/personas";

/**
 * The dashboard's geometry and its numbers, which axe cannot see.
 *
 * Every bar is a disclosure button, and the button is the whole column rather than the
 * coloured rectangle: a stage with nothing in it draws a 2 px hairline, and a 2 px tab
 * stop would fail WCAG 2.2 AA 2.5.8. That is the thing worth a test — it is invisible in
 * a screenshot and easy to undo by moving the height back onto the trigger.
 */
test.describe("the dashboard's stage chart", () => {
  test("every bar is a target a pointer can hit, empty stages included", async ({
    page,
  }) => {
    await enterAs(page, "priya");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();

    const bars = page.getByRole("button", { name: /^\w.*: \d+ loans?, \$/ });
    await expect(bars).toHaveCount(6);

    for (const bar of await bars.all()) {
      const box = await bar.boundingBox();
      expect(
        box,
        (await bar.getAttribute("aria-label")) ?? "bar",
      ).not.toBeNull();
      // WCAG 2.2 AA 2.5.8: 24 px minimum in both directions.
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(24);
    }
  });

  test("the fuller stage draws the taller bar", async ({ page }) => {
    await enterAs(page, "priya");
    const empty = page.getByRole("button", { name: /^Underwriting: 0 loans/ });
    const busy = page.getByRole("button", { name: /^Processing: 3 loans/ });
    await expect(empty).toBeVisible();

    // The bar itself is the aria-hidden span inside the column-sized button.
    const emptyBar = await empty.locator("span").boundingBox();
    const busyBar = await busy.locator("span").boundingBox();
    expect(busyBar?.height ?? 0).toBeGreaterThan((emptyBar?.height ?? 0) + 20);
  });

  test("a keyboard reaches the dollars a mouse gets from hovering", async ({
    page,
  }) => {
    await enterAs(page, "priya");
    const bar = page.getByRole("button", { name: /^Processing: 3 loans/ });
    // The label is the affordance: the visible tooltip needs focus-visible, which a
    // programmatic focus() does not set, but the dollars are in the accessible name
    // either way — which is what a screen reader and a keyboard actually read.
    await expect(bar).toHaveAttribute(
      "aria-label",
      /^Processing: 3 loans, \$[\d,]+$/,
    );
    await bar.focus();
    await expect(bar).toBeFocused();
  });
});

test.describe("the dashboard's numbers", () => {
  test("the loan officer's variant asks a narrower question", async ({
    page,
  }) => {
    await enterAs(page, "alex");
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { level: 1, name: "My dashboard" }),
    ).toBeVisible();

    // Three tiles about their own book, and none of the firm-level rates.
    await expect(
      page.getByText("My active pipeline", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Closing in 14 days", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Pull-through", { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText("Avg cycle time", { exact: true })).toHaveCount(
      0,
    );
    // One chart, not two: conditions aging is the processor's and the superadmin's.
    await expect(
      page.getByText("My pipeline by stage", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Conditions aging", { exact: true }),
    ).toHaveCount(0);
  });

  test("the chart's hidden summary carries every stage", async ({ page }) => {
    await enterAs(page, "priya");
    const summary = page.locator("figure p.sr-only");
    await expect(summary).toHaveText(
      /loans, \$[\d,]+: Lead \d+, Application \d+, Processing \d+, Underwriting \d+, Conditional approval \d+, Clear to close \d+\./,
    );
  });
});
