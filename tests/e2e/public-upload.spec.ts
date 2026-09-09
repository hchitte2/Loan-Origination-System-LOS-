import path from "node:path";
import { expect, test } from "@playwright/test";
import { openLoanFromPipeline, SHOWCASE, showcaseToken } from "./helpers/loans";
import { enterAs } from "./helpers/personas";

/**
 * The journey PLAN.md §9 calls Phase 3's done-when: a borrower with no session uploads
 * through their link, a processor rejects it with a reason, the borrower sees that reason
 * and sends another, the processor accepts and clears.
 *
 * The borrower's half runs in a context with no cookies at all, because "no session" is
 * the whole point — a test that reused a logged-in context would prove nothing.
 */

const SPECIMEN = path.join(process.cwd(), "src/db/specimens/specimen-w2.pdf");
const CONDITION = "Bank statements, last 2 months";

// One database behind every worker: these mutate the showcase loan, so they run in
// declaration order rather than racing each other for the same rows.
test.describe.configure({ mode: "serial" });

test.describe("the borrower's link", () => {
  test("carries the loan, and refuses to be guessed", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/u/${showcaseToken()}`);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /here's where your loan stands/,
      }),
    ).toBeVisible();
    // No session was needed to get here.
    expect(await context.cookies()).toHaveLength(0);

    const body = await page.locator("body").innerText();
    // The borrower's vocabulary, never the database's.
    expect(body).not.toContain("Requested");
    expect(body).not.toContain("Pending");
    expect(body).toContain(
      "Demo system with synthetic data. Do not upload real personal documents.",
    );

    await page.goto("/u/thistokenisnotrealatall00");
    await expect(
      page.getByRole("heading", { name: "This link is no longer active." }),
    ).toBeVisible();
    await context.close();
  });

  test("refuses a file that is too large, kindly", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/u/${showcaseToken()}`);

    await page
      .getByRole("checkbox", { name: /receive loan updates electronically/ })
      .check();
    const card = page.locator("section").filter({ hasText: CONDITION });
    await card.locator('input[type="file"]').setInputFiles({
      name: "too-big.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(11 * 1024 * 1024, 0x41),
    });

    // The zone shows it, and an alert announces the whole sentence.
    await expect(
      card.getByText("That file is too large", { exact: true }),
    ).toBeVisible();
    await expect(card.getByRole("alert")).toContainText(
      "That file is too large. Keep it under 10 MB and try again.",
    );
    await context.close();
  });

  test("refuses a file type that is not a document", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/u/${showcaseToken()}`);

    await page
      .getByRole("checkbox", { name: /receive loan updates electronically/ })
      .check();
    const card = page.locator("section").filter({ hasText: CONDITION });
    await card.locator('input[type="file"]').setInputFiles({
      name: "payload.exe",
      mimeType: "application/x-msdownload",
      buffer: Buffer.from("MZ"),
    });

    await expect(
      card.getByText("That kind of file will not open on our side", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(card.getByRole("alert")).toContainText(
      "Send a PDF, JPG or PNG.",
    );
    await context.close();
  });
});

test("upload, reject with a reason, send another, accept, clear", async ({
  browser,
}) => {
  // Maria: a phone, no session.
  const borrower = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const maria = await borrower.newPage();
  await maria.goto(`/u/${showcaseToken()}`);

  const card = maria.locator("section").filter({ hasText: CONDITION });
  await expect(card).toBeVisible();
  await maria
    .getByRole("checkbox", { name: /receive loan updates electronically/ })
    .check();
  await card.locator('input[type="file"]').setInputFiles(SPECIMEN);

  // The card turns over to "under review" once the server has the document.
  await expect(card.getByText("Received, under review")).toBeVisible();
  await expect(card.getByText("specimen-w2.pdf")).toBeVisible();
  // An item under review is not asking for anything more.
  await expect(card.locator('input[type="file"]')).toHaveCount(0);

  // Sam: the queue picks it up.
  const staff = await browser.newContext();
  const sam = await staff.newPage();
  await enterAs(sam, "sam");
  await expect(
    sam.getByRole("heading", { level: 1, name: "Queue" }),
  ).toBeVisible();
  const queueRow = sam.getByRole("row").filter({ hasText: "specimen-w2.pdf" });
  await expect(queueRow).toBeVisible();
  await queueRow.getByRole("link", { name: /^Open/ }).click();
  await sam.waitForURL(/\/loans\/[0-9a-f-]{36}\/needs-list/);

  // Reject it, with the reason Maria will read.
  const row = sam.locator("li").filter({ hasText: "specimen-w2.pdf" });
  await row.getByRole("button", { name: /^Reject/ }).click();
  await sam.getByRole("textbox").fill("Second page is missing.");
  await sam.getByRole("button", { name: "Reject document" }).click();
  await expect(
    row.getByText("Rejected · Second page is missing."),
  ).toBeVisible();

  // Maria is told, in her own words, what to do about it.
  await maria.reload();
  const reopened = maria.locator("section").filter({ hasText: CONDITION });
  await expect(
    reopened.getByText("Needs another: Second page is missing."),
  ).toBeVisible();
  await expect(reopened.locator('input[type="file"]')).toHaveCount(1);

  // She sends another.
  await maria
    .getByRole("checkbox", { name: /receive loan updates electronically/ })
    .check();
  await reopened.locator('input[type="file"]').setInputFiles(SPECIMEN);
  await expect(reopened.getByText("Received, under review")).toBeVisible();

  // Sam accepts it and is asked whether the condition itself is done.
  await sam.reload();
  const second = sam
    .locator("li")
    .filter({ hasText: "specimen-w2.pdf" })
    .filter({ hasText: "Pending" });
  await second.getByRole("button", { name: /^Accept/ }).click();
  const confirm = sam.getByRole("alertdialog");
  await expect(
    confirm.getByRole("heading", { name: "Clear this condition?" }),
  ).toBeVisible();
  await confirm.getByRole("button", { name: "Clear condition" }).click();

  await expect(
    sam.getByRole("row").filter({ hasText: CONDITION }).getByText("Cleared"),
  ).toBeVisible();

  // And Maria sees it accepted, with nothing left to do for it.
  await maria.reload();
  const cleared = maria.locator("section").filter({ hasText: CONDITION });
  await expect(cleared.getByText("Accepted")).toBeVisible();
  await expect(cleared.locator('input[type="file"]')).toHaveCount(0);

  await borrower.close();
  await staff.close();
});

test("a file URL is refused to a logged-out tab", async ({ browser }) => {
  // Alex, because a processor is sent to the queue rather than the pipeline, and
  // document.download is "any" for every staff role.
  const staff = await browser.newContext();
  const alex = await staff.newPage();
  await enterAs(alex, "alex");
  const loan = await openLoanFromPipeline(alex, SHOWCASE.street);
  await alex.goto(`${loan}/needs-list`);
  // One panel is open at a time, so open one that actually holds a document: the
  // chevron's name ends in the count, or "none".
  await alex
    .getByRole("button", { name: /^Show documents for .* · \d+$/ })
    .first()
    .click();

  const href = await alex
    .getByRole("link", { name: /^Download/ })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^\/api\/files\//);

  // The same URL, from a context that has never signed in.
  const stranger = await browser.newContext();
  const response = await stranger.request.get(href ?? "", { maxRedirects: 0 });
  expect(response.status()).toBe(401);

  // And it is still a real download for Alex.
  const mine = await alex.request.get(href ?? "");
  expect(mine.status()).toBe(200);
  expect(mine.headers()["cache-control"]).toBe("private, no-store");

  await stranger.close();
  await staff.close();
});
