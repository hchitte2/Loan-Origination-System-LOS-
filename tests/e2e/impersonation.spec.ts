import { expect, test } from "@playwright/test";
import { enterAs } from "./helpers/personas";

test("Priya views as Sam, sees the banner everywhere, cannot open Users, exits, and both rows are logged", async ({
  page,
}) => {
  await enterAs(page, "priya");
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { level: 1, name: "Users" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "View as Sam Okafor" }).click();
  await expect(page).toHaveURL("/queue");
  const banner = page
    .getByRole("status")
    .filter({ hasText: "Viewing as Sam Okafor · Processor" });
  await expect(banner).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);

  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { level: 1, name: "Not available" }),
  ).toBeVisible();
  await expect(banner).toBeVisible();

  await page.getByRole("button", { name: "Exit view" }).click();
  await expect(page).toHaveURL("/admin/users");
  await expect(
    page.getByRole("status").filter({ hasText: "Viewing as" }),
  ).toHaveCount(0);

  await page.goto("/admin/activity?filter=impersonation");
  const rows = page.getByRole("row");
  await expect(
    rows
      .filter({ hasText: "Priya Nair stopped viewing as Sam Okafor" })
      .first(),
  ).toBeVisible();
  await expect(
    rows
      .filter({ hasText: "Priya Nair started viewing as Sam Okafor" })
      .first(),
  ).toBeVisible();
});
