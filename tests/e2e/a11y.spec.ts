import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
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
  });
}

async function expectNoSeriousViolations(page: Page) {
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
