import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { openLoanFromPipeline, SHOWCASE, showcaseToken } from "./helpers/loans";
import { enterAs } from "./helpers/personas";

/**
 * axe on each top-level route in light and dark; serious and critical violations fail.
 * The theme defaults to "system", so emulating the colour scheme is enough to switch.
 */
const SCHEMES = ["light", "dark"] as const;

for (const scheme of SCHEMES) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test(`/login has no serious or critical axe violations`, async ({
      page,
    }) => {
      await page.goto("/login");
      await expect(
        page.getByRole("button", { name: "Enter as Priya Nair" }),
      ).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`/admin/users has no serious or critical axe violations`, async ({
      page,
    }) => {
      await enterAs(page, "priya");
      await page.goto("/admin/users");
      await expect(
        page.getByRole("heading", { level: 1, name: "Users" }),
      ).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`/pipeline board has no serious or critical axe violations`, async ({
      page,
    }) => {
      await enterAs(page, "alex");
      await expect(
        page.getByRole("heading", { level: 1, name: "Pipeline" }),
      ).toBeVisible();
      // The board's cards, stage pills, attention tags and Move to… trigger.
      await expect(page.getByRole("article").first()).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`/pipeline list and its Closed section have no serious or critical axe violations`, async ({
      page,
    }) => {
      await enterAs(page, "alex");
      await page.goto("/pipeline?view=list");
      await expect(page.getByRole("table").first()).toBeVisible();
      // Expanded, so the second table is in the tree when axe runs.
      await page.getByRole("button", { name: /^Closed/ }).click();
      await expect(page.getByRole("table")).toHaveCount(2);
      await expectNoSeriousViolations(page);
    });

    test(`/loans/new has no serious or critical axe violations`, async ({
      page,
    }) => {
      await enterAs(page, "alex");
      await page.goto("/loans/new");
      await expect(
        page.getByRole("heading", { level: 1, name: "New loan" }),
      ).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`/loans/[id] tabs have no serious or critical axe violations`, async ({
      page,
    }) => {
      await enterAs(page, "alex");
      const loan = await openLoanFromPipeline(page, SHOWCASE.street);

      // Overview: the facts, the people and the borrower link.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: "Borrower link" }),
      ).toBeVisible();
      await expectNoSeriousViolations(page);

      // Needs list: the conditions table, its pills and tags.
      await page.goto(`${loan}/needs-list`);
      await expect(page.getByRole("table")).toBeVisible();
      await expectNoSeriousViolations(page);

      // Activity: the sentence rows.
      await page.goto(`${loan}/activity`);
      await expect(
        page.getByRole("heading", { level: 2, name: /^Activity/ }),
      ).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`/queue has no serious or critical axe violations`, async ({
      page,
    }) => {
      await enterAs(page, "sam");
      await expect(
        page.getByRole("heading", { level: 1, name: "Queue" }),
      ).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`/admin/activity and its reset confirm have no serious or critical axe violations`, async ({
      page,
    }) => {
      await enterAs(page, "priya");
      await page.goto("/admin/activity");
      await expect(
        page.getByRole("heading", { level: 1, name: "Activity log" }),
      ).toBeVisible();
      await expectNoSeriousViolations(page);

      // The confirm only; pressing it through would truncate the database this suite
      // is reading in parallel.
      await page.getByRole("button", { name: "Reset demo data" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`/dashboard has no serious or critical axe violations`, async ({
      page,
    }) => {
      await enterAs(page, "priya");
      await expect(
        page.getByRole("heading", { level: 1, name: "Dashboard" }),
      ).toBeVisible();
      // The bar chart's disclosure buttons, the aging bars and the attention table.
      await expect(page.getByRole("table")).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`the loan officer's /dashboard has no serious or critical axe violations`, async ({
      page,
    }) => {
      await enterAs(page, "alex");
      await page.goto("/dashboard");
      await expect(
        page.getByRole("heading", { level: 1, name: "My dashboard" }),
      ).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`/u/[token] has no serious or critical axe violations`, async ({
      page,
    }) => {
      // No session: the borrower's page is reached by token alone.
      await page.goto(`/u/${showcaseToken()}`);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /here's where your loan stands/,
        }),
      ).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`the dead-link page has no serious or critical axe violations`, async ({
      page,
    }) => {
      await page.goto("/u/thistokenisnotrealatall00");
      await expect(
        page.getByRole("heading", { name: "This link is no longer active." }),
      ).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`the needs list, expanded over a document, has no serious or critical axe violations`, async ({
      page,
    }) => {
      await enterAs(page, "sam");
      const row = page.getByRole("row").filter({ hasText: ".pdf" }).first();
      await row.getByRole("link", { name: /^Open/ }).click();
      await page.waitForURL(/\/loans\/[0-9a-f-]{36}\/needs-list/);
      // The reject form is the densest state on this screen: a labelled field, an
      // expanded control and two buttons inside a table cell.
      await page
        .getByRole("button", { name: /^Reject/ })
        .first()
        .click();
      await expect(page.getByRole("textbox")).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`the dialogs this phase adds have no serious or critical axe violations`, async ({
      page,
    }) => {
      await enterAs(page, "alex");

      // New loan, intercepted over the board.
      await page.getByRole("link", { name: "New loan" }).click();
      await expect(
        page.getByRole("dialog", { name: "New loan" }),
      ).toBeVisible();
      await expectNoSeriousViolations(page);
      await page.keyboard.press("Escape");

      // Add condition.
      const loan = await openLoanFromPipeline(page, SHOWCASE.street);
      await page.goto(`${loan}/needs-list`);
      await page.getByRole("button", { name: "Add condition" }).click();
      await expect(
        page.getByRole("dialog", { name: "Add condition" }),
      ).toBeVisible();
      await expectNoSeriousViolations(page);
      await page.keyboard.press("Escape");

      // The withdraw confirm, which is an alertdialog carrying a form.
      await page.goto("/pipeline");
      const card = page
        .getByRole("article")
        .filter({ hasText: SHOWCASE.borrowerName.split(" ").at(-1) ?? "" })
        .first();
      await card.getByRole("button", { name: /^Move / }).click();
      await page.getByRole("menuitem", { name: "Withdraw…" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await expectNoSeriousViolations(page);
    });
  });
}

async function expectNoSeriousViolations(page: Page) {
  // Wait for every running transition to finish first. A dialog captured mid-fade has a
  // blended background, and axe reports the intermediate colours as contrast failures —
  // a flake, not a defect, and one that only shows up on whichever run happens to be
  // slower. Awaiting the animations is deterministic; a sleep would not be.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
    ),
  ).toEqual([]);
}
