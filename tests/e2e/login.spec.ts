import { expect, test } from "@playwright/test";
import { enterAs, PERSONAS } from "./helpers/personas";

for (const persona of PERSONAS) {
  test(`${persona.name} enters and lands on ${persona.home}`, async ({
    page,
  }) => {
    await enterAs(page, persona.key);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByText("Demo · synthetic data")).toBeVisible();
    await expect(
      page.getByRole("button", { name: new RegExp(persona.name) }),
    ).toBeVisible();
  });
}

test("a signed-in visitor is sent home from /login and back after signing out", async ({
  page,
}) => {
  await enterAs(page, "alex");
  await page.goto("/login");
  await expect(page).toHaveURL("/pipeline");

  await page.getByRole("button", { name: /Alex Rivera/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
  await expect(
    page.getByRole("button", { name: "Enter as Priya Nair" }),
  ).toBeVisible();
});

test("a staff route without a session redirects to /login", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/login");
});
