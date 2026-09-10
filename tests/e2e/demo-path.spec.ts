import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { enterAs } from "./helpers/personas";
import { sendFile } from "./helpers/uploads";

/**
 * The demo script (PLAN.md §13), walked end to end in one test.
 *
 * The point is not to re-prove what the other specs already cover — it is that the path
 * someone walks in front of an audience works *as one continuous journey*, in order, with
 * the same tab and the same session. Every other spec starts from a clean slate; this one
 * cannot, because step 5 depends on what step 3 created.
 *
 * The loan is new rather than the fixture's, so the run is repeatable and leaves the
 * showcase loan alone for the specs that read it.
 */

const SPECIMEN = path.join(
  process.cwd(),
  "src/db/specimens/specimen-pay-stub.pdf",
);
/**
 * Not §13's "412 Maple Ave": that is the fixture's own showcase loan (`seed.ts`,
 * SHOWCASE_LOAN_KEY), so following the script literally puts two "Chen · 412 Maple Ave"
 * rows on the pipeline and every address-based selector — here and in the specs that run
 * beside this one — matches both. Worth knowing before a rehearsal, too: a presenter who
 * types the scripted address gets the same duplicate on screen.
 */
const STREET = "88 Willow Bend";
const ADDRESS = `${STREET}, Austin TX 78704`;
const BORROWER = "Maria Chen";
const PAY_STUBS = "Pay stubs";
const REJECTION = "Only one stub; we need 30 days.";

test.describe.configure({ mode: "serial" });

/** Wait for a Server Action's revalidation to land rather than for a fixed time. */
async function expectStage(page: Page, stage: string) {
  await expect(page.getByRole("main").getByText(stage).first()).toBeVisible();
}

test("the demo script runs end to end", async ({ browser }) => {
  test.slow();

  // ---------------------------------------------------------------------------------
  // 1. Login — three roles on one screen.
  // ---------------------------------------------------------------------------------
  // The demo copies the borrower's link to the clipboard, which needs the permission a
  // real browser grants on a user gesture.
  const staff = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await staff.newPage();
  await page.goto("/login");
  for (const name of ["Priya Nair", "Alex Rivera", "Sam Okafor"]) {
    await expect(
      page.getByRole("button", { name: `Enter as ${name}` }),
    ).toBeVisible();
  }

  // ---------------------------------------------------------------------------------
  // 2. Priya, superadmin — the dashboard, then View as Alex.
  // ---------------------------------------------------------------------------------
  await enterAs(page, "priya");
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" }),
  ).toBeVisible();
  await expect(
    page.getByText("Active pipeline", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Funded this month", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Pull-through", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Pipeline by stage", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /^Needs attention/ }),
  ).toBeVisible();

  await page.goto("/admin/users");
  await page.getByRole("button", { name: "View as Alex Rivera" }).click();
  const banner = page
    .getByRole("status")
    .filter({ hasText: "Viewing as Alex Rivera" });
  await expect(banner).toBeVisible();

  // ---------------------------------------------------------------------------------
  // 3. As Alex — a new loan, two moves, the needs list, the borrower's link.
  // ---------------------------------------------------------------------------------
  await page.goto("/pipeline");
  await page.getByRole("link", { name: "New loan" }).click();
  await page.waitForURL("**/loans/new");

  await page.getByLabel("Borrower name").fill(BORROWER);
  await page
    .getByLabel("Email", { exact: true })
    .fill("maria.chen@example.com");
  await page.getByLabel("Property address").fill(ADDRESS);
  await page.getByLabel("Loan amount").fill("485000");
  await page.getByRole("button", { name: "Create loan" }).click();

  await page.waitForURL(/\/loans\/[0-9a-f-]{36}/);
  const loanPath = new URL(page.url()).pathname;
  await expect(
    page.getByRole("heading", { level: 1, name: /Chen/ }),
  ).toBeVisible();

  // Lead → Application → Processing. The move that carries the file forward is the
  // screen's one primary button; "Move to…" beside it holds the backward and closing
  // moves. Either way it goes through transitions.ts, never by setting the column.
  for (const [label, stage] of [
    ["Take the application", "Application"],
    ["Start processing", "Processing"],
  ] as const) {
    await page.getByRole("button", { name: label }).click();
    await expectStage(page, stage);
  }

  // Creating the loan seeded its needs list.
  await page.goto(`${loanPath}/needs-list`);
  const items = page
    .getByRole("row")
    .filter({ hasText: /Requested|Received|Cleared/ });
  // count() does not auto-wait, and the needs list streams in behind its own skeleton.
  await expect(items.first()).toBeVisible();
  expect(await items.count()).toBeGreaterThanOrEqual(6);

  await page.goto(loanPath);
  // The demo copies the link rather than reading it off the screen, so the copy is what
  // is tested: it writes the absolute URL and says so.
  await page.getByRole("button", { name: "Copy Maria's link" }).click();
  await expect(page.getByText("Maria's link copied.")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/^https?:\/\/[^/]+\/u\/[A-Za-z0-9_-]+$/);
  const link = new URL(copied).pathname;

  // ---------------------------------------------------------------------------------
  // 4. Maria, on a phone, with no account at all.
  // ---------------------------------------------------------------------------------
  const borrower = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const maria = await borrower.newPage();
  await maria.goto(link as string);
  await expect(
    maria.getByRole("heading", {
      level: 1,
      name: /here's where your loan stands/,
    }),
  ).toBeVisible();
  expect(await borrower.cookies()).toHaveLength(0);

  await maria
    .getByRole("checkbox", { name: /receive loan updates electronically/ })
    .check();
  const stubs = maria.locator("section").filter({ hasText: PAY_STUBS });
  await sendFile(stubs, SPECIMEN, "borrower");
  await expect(stubs.getByText("Received, under review")).toBeVisible();

  // ---------------------------------------------------------------------------------
  // 5. Exit view → View as Sam: reject, re-upload, accept, clear, then two moves.
  // ---------------------------------------------------------------------------------
  await page.getByRole("button", { name: "Exit view" }).click();
  await expect(banner).toBeHidden();
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "View as Sam Okafor" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Viewing as Sam Okafor" }),
  ).toBeVisible();

  await page.goto("/queue");
  // Scoped to this loan by its own link: the queue is the whole firm's, and a previous
  // run of this spec leaves a loan of its own in it.
  const queueRow = page
    .getByRole("row")
    .filter({ has: page.locator(`a[href^="${loanPath}"]`) });
  await expect(queueRow).toBeVisible();
  await queueRow.getByRole("link", { name: /^Open/ }).click();
  await page.waitForURL(/\/needs-list/);

  const uploaded = page
    .locator("li")
    .filter({ hasText: "specimen-pay-stub.pdf" });
  await uploaded.getByRole("button", { name: /^Reject/ }).click();
  await page.getByRole("textbox").fill(REJECTION);
  await page.getByRole("button", { name: "Reject document" }).click();
  await expect(uploaded.getByText(`Rejected · ${REJECTION}`)).toBeVisible();

  // Maria reads the reason in her own words and sends another.
  await maria.reload();
  const reopened = maria.locator("section").filter({ hasText: PAY_STUBS });
  await expect(reopened.getByText(`Needs another: ${REJECTION}`)).toBeVisible();
  await maria
    .getByRole("checkbox", { name: /receive loan updates electronically/ })
    .check();
  await sendFile(reopened, SPECIMEN, "borrower");
  await expect(reopened.getByText("Received, under review")).toBeVisible();

  await page.reload();
  const second = page
    .locator("li")
    .filter({ hasText: "specimen-pay-stub.pdf" })
    .filter({ hasText: "Pending" });
  await second.getByRole("button", { name: /^Accept/ }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(
    confirm.getByRole("heading", { name: "Clear this condition?" }),
  ).toBeVisible();
  await confirm.getByRole("button", { name: "Clear condition" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: PAY_STUBS }).getByText("Cleared"),
  ).toBeVisible();

  await page.goto(loanPath);
  await page.getByRole("button", { name: "Submit to underwriting" }).click();
  await expectStage(page, "Underwriting");
  await page
    .getByRole("button", { name: "Issue conditional approval" })
    .click();
  await expectStage(page, "Conditional approval");

  // ---------------------------------------------------------------------------------
  // 6. Exit view, back as Priya — the log is honest about who really acted.
  // ---------------------------------------------------------------------------------
  // Exiting redirects back to where the view started; navigating before that lands
  // loses the goto. The banner going is the signal, whichever page it returns to.
  await page.getByRole("button", { name: "Exit view" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Viewing as" }),
  ).toBeHidden();
  await page.goto(`${loanPath}/activity`);
  await expect(
    page.getByText(/Priya Nair \(viewing as Sam Okafor\) rejected/),
  ).toBeVisible();

  await page.goto("/admin/activity?filter=impersonation");
  // first(): newest first, and a previous run of this spec leaves rows of its own.
  await expect(
    page.getByText("Priya Nair started viewing as Sam Okafor").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Priya Nair stopped viewing as Sam Okafor").first(),
  ).toBeVisible();

  await borrower.close();
  await staff.close();
});
