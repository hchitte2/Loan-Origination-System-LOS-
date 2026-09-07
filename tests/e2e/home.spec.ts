import { expect, test } from "@playwright/test";

test("the placeholder home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Clearline");
  await expect(
    page.getByRole("heading", { level: 1, name: "Clearline" }),
  ).toBeVisible();
  await expect(page.getByText("Demo · synthetic data")).toBeVisible();
});
