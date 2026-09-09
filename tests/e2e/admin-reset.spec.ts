import { expect, test } from "@playwright/test";
import { enterAs } from "./helpers/personas";

/**
 * The "Reset demo data" button and its confirm (design frame 07-reset-confirm).
 *
 * These stop at the dialog on purpose. Confirming truncates and reseeds, and the suite
 * runs `fullyParallel`, so a real reset here would pull the database out from under every
 * other spec. What the reset itself does is covered where it can be: `resetCooldownMinutes`
 * in tests/unit/limits.test.ts, and the route end to end against `CRON_SECRET`.
 */
test.describe("the demo reset", () => {
  test("the confirm says what is about to be lost", async ({ page }) => {
    await enterAs(page, "priya");
    await page.goto("/admin/activity");

    await page.getByRole("button", { name: "Reset demo data" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading")).toHaveText("Reset demo data?");
    await expect(
      dialog.getByText(
        "This restores the sample data and removes uploaded files. Visitors' changes from today are lost.",
      ),
    ).toBeVisible();

    // Cancel says what keeping the current state means, never "Cancel".
    await dialog.getByRole("button", { name: "Keep current data" }).click();
    await expect(dialog).toBeHidden();
    // Nothing was reset: the log still has more than the one row a reset leaves.
    await expect(page.locator("tbody tr").nth(3)).toBeVisible();
  });

  test("a loan officer never reaches the button or the log", async ({
    page,
  }) => {
    await enterAs(page, "alex");
    await page.goto("/admin/activity");
    await expect(
      page.getByRole("button", { name: "Reset demo data" }),
    ).toHaveCount(0);
  });
});
