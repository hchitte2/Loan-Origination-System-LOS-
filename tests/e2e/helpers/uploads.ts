import type { Locator, Page } from "@playwright/test";

/**
 * Pick a file and send it.
 *
 * Choosing no longer uploads: the zone holds the file and shows it first, so the person
 * can see what they picked before it goes (`UploadZone`, the "picked, not yet sent"
 * state). Every upload in the suite is two steps, and this is the one place that knows.
 *
 * A file the zone refuses — wrong type, too large — never reaches this state, so the
 * specs that check those refusals call `setInputFiles` directly and expect the error.
 */
export async function sendFile(
  scope: Page | Locator,
  file: Parameters<Locator["setInputFiles"]>[0],
  audience: "staff" | "borrower" = "staff",
): Promise<void> {
  await scope.locator('input[type="file"]').first().setInputFiles(file);
  await scope
    .getByRole("button", {
      name: audience === "borrower" ? "Send this file" : "Upload file",
    })
    .click();
}
