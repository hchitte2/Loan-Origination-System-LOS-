import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { enterAs, type PersonaKey } from "./helpers/personas";

/**
 * Taking back your own upload before anyone has reviewed it.
 *
 * The refusals are the point. The button is presentation — a Server Action accepts a
 * direct POST — so what these check is that a file only leaves when the person asking is
 * the person who sent it and nobody has ruled on it yet.
 */
const SPECIMEN = path.join(process.cwd(), "src/db/specimens/specimen-w2.pdf");
const FILE = "specimen-w2.pdf";

test.describe.configure({ mode: "serial" });

/** Open a loan of Alex's and expand one condition that has nothing on it yet. */
async function openEmptyCondition(
  page: Page,
  persona: PersonaKey,
  street: string,
): Promise<{ loan: string; title: string }> {
  await enterAs(page, persona);
  await page.goto("/pipeline?view=list");
  await page
    .getByRole("row")
    .filter({ hasText: street })
    .getByRole("link")
    .first()
    .click();
  await page.waitForURL(/\/loans\/[0-9a-f-]{36}/);
  const loan = new URL(page.url()).pathname;

  await page.goto(`${loan}/needs-list`);
  await page.getByRole("table").waitFor();
  const toggle = page
    .getByRole("button", { name: /^Show documents for .* · none$/ })
    .first();
  // The name may sit on aria-label or in the text, depending on the trigger.
  const label = await toggle.evaluate(
    (el) => el.getAttribute("aria-label") ?? el.textContent ?? "",
  );
  const title = label
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^Show documents for /, "")
    .replace(/ · none$/, "");
  if (!title) throw new Error(`No condition title in "${label}"`);
  await toggle.click();
  return { loan, title };
}

test("the uploader can take back a pending file, and the condition reopens", async ({
  page,
}) => {
  const { loan, title } = await openEmptyCondition(
    page,
    "alex",
    "640 Sunset Blvd",
  );

  await page.locator('input[type="file"]').first().setInputFiles(SPECIMEN);
  const doc = page.locator("li").filter({ hasText: FILE });
  await expect(doc.getByText("Pending")).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Hide documents for ${title} · 1` }),
  ).toBeVisible();

  await doc.getByRole("button", { name: `Remove ${FILE}` }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("heading")).toHaveText(`Remove ${FILE}?`);
  await expect(
    dialog.getByText(
      "The file is deleted and the item goes back to being requested. This cannot be undone.",
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Remove file" }).click();
  await expect(page.getByText(`${FILE} removed.`)).toBeVisible();

  await page.reload();
  await page.getByRole("table").waitFor();
  // Back to being asked for, with nothing on it.
  await expect(
    page.getByRole("button", { name: `Show documents for ${title} · none` }),
  ).toBeVisible();

  // The removal is in the log, and the log cannot be removed.
  await page.goto(`${loan}/activity`);
  await expect(
    page.getByText(`Alex Rivera deleted ${FILE} before review`).first(),
  ).toBeVisible();
});

test("a colleague sees no Remove on someone else's upload", async ({
  browser,
}) => {
  // A context per persona: signing in again in the same one is a redirect home, not a
  // second login card.
  const alexContext = await browser.newContext();
  const alex = await alexContext.newPage();
  const { loan, title } = await openEmptyCondition(
    alex,
    "alex",
    "640 Sunset Blvd",
  );
  await alex.locator('input[type="file"]').first().setInputFiles(SPECIMEN);
  await expect(
    alex.locator("li").filter({ hasText: FILE }).getByText("Pending"),
  ).toBeVisible();

  // Sam has `document.delete: any` on the loan, but the file is not his.
  const samContext = await browser.newContext();
  const sam = await samContext.newPage();
  await enterAs(sam, "sam");
  await sam.goto(`${loan}/needs-list`);
  await sam
    .getByRole("button", { name: `Show documents for ${title} · 1` })
    .click();
  const asSam = sam.locator("li").filter({ hasText: FILE });
  await expect(asSam.getByText("Pending")).toBeVisible();
  await expect(
    asSam.getByRole("button", { name: `Remove ${FILE}` }),
  ).toHaveCount(0);
  // What he can do instead is review it.
  await expect(asSam.getByRole("button", { name: /^Accept/ })).toBeVisible();

  // And once he rejects it, the uploader cannot take it back either: it is now the
  // record of a decision, not an upload waiting to be corrected.
  await asSam.getByRole("button", { name: /^Reject/ }).click();
  await sam.getByRole("textbox").fill("Wrong document for this item.");
  await sam.getByRole("button", { name: "Reject document" }).click();
  await expect(asSam.getByText(/Rejected ·/)).toBeVisible();

  await alex.reload();
  await alex.getByRole("table").waitFor();
  await alex
    .getByRole("button", { name: new RegExp(`documents for ${title}`) })
    .first()
    .click();
  await expect(
    alex
      .locator("li")
      .filter({ hasText: FILE })
      .getByRole("button", { name: `Remove ${FILE}` }),
  ).toHaveCount(0);

  await alexContext.close();
  await samContext.close();
});
