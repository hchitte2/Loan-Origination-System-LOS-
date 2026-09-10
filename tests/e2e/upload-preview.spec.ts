import { expect, test } from "@playwright/test";
import { showcaseToken } from "./helpers/loans";

/**
 * Looking at a file before sending it.
 *
 * The point is that nothing reaches the network until the person says so: a wrong pick
 * costs no upload slot and no `put` against the month's budget. It also matters more to
 * the borrower than to staff, because the public page never serves the bytes back — the
 * moment before sending is the only time they can see what they are sending.
 */
const PIXEL = {
  name: "paystub-photo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
};

test.describe.configure({ mode: "serial" });

test("the borrower sees the photo, and nothing is sent until they say so", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(`/u/${showcaseToken()}`);
  await page
    .getByRole("checkbox", { name: /receive loan updates electronically/ })
    .check();

  const open = page
    .locator("section")
    .filter({ has: page.locator('input[type="file"]') })
    .first();
  const title = (await open.locator("h2, h3").first().innerText()).trim();
  const card = page.locator("section").filter({ hasText: title }).first();

  await card.locator('input[type="file"]').setInputFiles(PIXEL);

  const panel = card.getByRole("status");
  await expect(panel.getByText("Does this look right?")).toBeVisible();
  await expect(panel.locator("img")).toBeVisible();
  await expect(panel.getByText(`${PIXEL.name} ·`)).toBeVisible();

  // The upload has not happened: the item is still being asked for.
  await expect(card.getByText("Received, under review")).toHaveCount(0);

  // Touch targets on the public page are 44 px (design-system skill).
  for (const name of ["Send this file", "Choose a different one"]) {
    const box = await panel.getByRole("button", { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await panel.getByRole("button", { name: "Send this file" }).click();
  await expect(card.getByText("Received, under review")).toBeVisible();
  await context.close();
});

test("a file the zone refuses never reaches the check step", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/u/${showcaseToken()}`);
  await page
    .getByRole("checkbox", { name: /receive loan updates electronically/ })
    .check();

  const open = page
    .locator("section")
    .filter({ has: page.locator('input[type="file"]') })
    .first();
  const title = (await open.locator("h2, h3").first().innerText()).trim();
  const card = page.locator("section").filter({ hasText: title }).first();

  await card.locator('input[type="file"]').setInputFiles({
    name: "payload.exe",
    mimeType: "application/x-msdownload",
    buffer: Buffer.from("MZ"),
  });

  // Refused where it is picked, so it is never held for checking and never uploaded.
  await expect(
    card.getByText("That kind of file will not open on our side", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(card.getByText("Does this look right?")).toHaveCount(0);
  await context.close();
});
