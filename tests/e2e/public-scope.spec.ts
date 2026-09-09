import { expect, test } from "@playwright/test";
import { fixtureLoans, SHOWCASE_LOAN_KEY } from "../../src/db/seed";
import { showcaseToken } from "./helpers/loans";

/**
 * What the borrower's page is allowed to contain (PLAN.md §11, `.claude/rules/testing.md`).
 *
 * These assert on the **raw response body**, not the rendered DOM, because a Server
 * Component serialises what it fetches: a field loaded and then not drawn is still in the
 * payload, and a component that "hides" it hides nothing. `tests/unit/redact.test.ts`
 * proves `redactForPublic` drops the right fields; this proves the page only ever asks
 * it, and never reaches around it.
 */

const SHOWCASE = (() => {
  const loan = fixtureLoans().find((l) => l.key === SHOWCASE_LOAN_KEY);
  if (!loan) throw new Error(`No fixture loan keyed ${SHOWCASE_LOAN_KEY}`);
  return loan;
})();

test("the borrower's page serialises only what it may show", async ({
  request,
}) => {
  const response = await request.get(`/u/${showcaseToken()}`);
  expect(response.status()).toBe(200);
  const body = await response.text();

  // It really is the borrower's page, so the absences below mean something.
  expect(body).toContain("here&#x27;s where your loan stands");

  // Contact details of record. The page addresses them by first name and never quotes
  // the email or phone the loan was opened with.
  expect(body).not.toContain(SHOWCASE.borrowerEmail);
  if (SHOWCASE.borrowerPhone) {
    expect(body).not.toContain(SHOWCASE.borrowerPhone);
  }

  // Anything that would let bytes be pulled, or a document be named by id.
  expect(body).not.toContain("/api/files/");
  expect(body).not.toContain("blobPathname");
  expect(body).not.toContain("blob_pathname");

  // Enum values. The borrower reads labels; the database's words never reach them.
  for (const enumValue of [
    '"processing"',
    '"conditional_approval"',
    '"requested"',
    '"received"',
    '"cleared"',
    '"waived"',
    '"public_link"',
    '"pending"',
    '"rejected"',
  ]) {
    expect(body).not.toContain(enumValue);
  }

  // The staff vocabulary for a rejection. Theirs is "Needs another: …".
  expect(body).not.toContain("Rejected ·");

  // Other people's loans, and the staff who work this one beyond the loan officer.
  const otherBorrower = fixtureLoans().find(
    (l) => l.key !== SHOWCASE_LOAN_KEY,
  )?.borrowerName;
  if (otherBorrower) expect(body).not.toContain(otherBorrower);
});

test("an internal condition never reaches the borrower", async ({
  request,
}) => {
  const internal = SHOWCASE.conditions?.find(
    (condition) => condition.borrowerFacing === false,
  );
  // The fixture is expected to carry one; if it stops, this test has nothing to prove
  // and should be re-pointed rather than passing vacuously.
  expect(
    internal,
    "the showcase loan should carry an internal condition, so this test has something to look for",
  ).toBeDefined();

  const body = await (await request.get(`/u/${showcaseToken()}`)).text();
  expect(body).not.toContain(internal?.title ?? "");
  if (internal?.instructions) {
    expect(body).not.toContain(internal.instructions);
  }
});

test("a revoked or unknown token serialises nothing about any loan", async ({
  request,
}) => {
  const body = await (await request.get("/u/thistokenisnotrealatall00")).text();
  expect(body).toContain("This link is no longer active.");
  expect(body).not.toContain(SHOWCASE.borrowerName);
  expect(body).not.toContain(SHOWCASE.street);
  expect(body).not.toContain(SHOWCASE.borrowerEmail);
});
