import { describe, expect, it } from "vitest";
import { type PublicSource, redactForPublic } from "@/server/authz";

/**
 * `.claude/rules/testing.md` asks for a field-absence test on `redactForPublic`, because
 * a Server Component serialises what it fetches: anything this function lets through is
 * in the HTML whether or not a component draws it.
 *
 * So the source below deliberately carries things the borrower must never see, and the
 * tests assert on the serialised JSON, not on the object's shape.
 */

const SOURCE: PublicSource = {
  loan: {
    id: "8b1f0c2e-1111-4222-8333-444455556666",
    borrowerName: "Maria Chen",
    propertyStreet: "412 Maple Ave",
    propertyCity: "Austin",
    propertyState: "TX",
    amount: 485_000,
    purpose: "purchase",
    loanType: "conventional",
    stage: "processing",
    targetCloseDate: "2026-10-03",
  },
  loanOfficer: { name: "Alex Rivera", phone: "(512) 555-0134" },
  conditions: [
    {
      id: "c-photo",
      title: "Government photo ID",
      instructions: "A driver's licence or passport.",
      status: "cleared",
      borrowerFacing: true,
      lastRejectionReason: null,
    },
    {
      id: "c-paystub",
      title: "Pay stubs, last 30 days",
      instructions: "Your two most recent pay stubs, all pages.",
      status: "requested",
      borrowerFacing: true,
      lastRejectionReason: "pages are cut off",
    },
    {
      id: "c-binder",
      title: "Homeowners insurance binder",
      instructions: null,
      status: "waived",
      borrowerFacing: true,
      lastRejectionReason: null,
    },
    {
      id: "c-internal",
      title: "Appraisal received",
      instructions: "Internal only — never shown to the borrower.",
      status: "requested",
      borrowerFacing: false,
      lastRejectionReason: null,
    },
  ],
  documents: [
    {
      conditionId: "c-paystub",
      fileName: "paystub-aug.pdf",
      createdAt: new Date("2026-09-04T10:00:00.000Z"),
      uploadedVia: "public_link",
    },
    {
      conditionId: "c-paystub",
      fileName: "processor-scan.pdf",
      createdAt: new Date("2026-09-05T10:00:00.000Z"),
      uploadedVia: "staff",
    },
    {
      conditionId: "c-internal",
      fileName: "appraisal-internal.pdf",
      createdAt: new Date("2026-09-05T11:00:00.000Z"),
      uploadedVia: "staff",
    },
  ],
};

const view = redactForPublic(SOURCE);
const serialised = JSON.stringify(view);

describe("redactForPublic keeps internal facts out of the payload", () => {
  it("drops conditions that are not borrower-facing", () => {
    expect(view.conditions.map((c) => c.id)).toEqual([
      "c-photo",
      "c-paystub",
      "c-binder",
    ]);
    expect(serialised).not.toContain("Appraisal received");
    expect(serialised).not.toContain("Internal only");
  });

  it("shows only what the borrower sent, not what staff uploaded", () => {
    const paystub = view.conditions.find((c) => c.id === "c-paystub");
    expect(paystub?.documents.map((d) => d.fileName)).toEqual([
      "paystub-aug.pdf",
    ]);
    expect(serialised).not.toContain("processor-scan.pdf");
    expect(serialised).not.toContain("appraisal-internal.pdf");
  });

  it("never carries a document id or anything to download by", () => {
    expect(serialised).not.toContain("blobPathname");
    expect(serialised).not.toContain("documentId");
    // The loan's own folder is the one path that reaches the browser: an upload has to
    // be addressed somewhere. It names no document and opens nothing on its own.
    expect(view.uploadPrefix).toBe(`uploads/${SOURCE.loan.id}/`);
  });

  it("never carries an enum value", () => {
    for (const enumValue of [
      "processing",
      "conventional",
      "purchase",
      "public_link",
      "staff",
    ]) {
      expect(serialised).not.toContain(`"${enumValue}"`);
    }
  });

  it("never carries the token, a staff id or the borrower's contact details", () => {
    expect(serialised).not.toContain("uploadToken");
    expect(serialised).not.toContain("loanOfficerId");
    expect(serialised).not.toContain("borrowerEmail");
    expect(serialised).not.toContain("borrowerPhone");
  });
});

describe("redactForPublic speaks the borrower's language", () => {
  it("addresses them by first name and names their loan officer", () => {
    expect(view.borrowerFirstName).toBe("Maria");
    expect(view.loanOfficer.firstName).toBe("Alex");
    expect(view.loanOfficer.name).toBe("Alex Rivera");
    expect(view.loanOfficer.phone).toBe("(512) 555-0134");
  });

  it("gives the stage its borrower label and its place in the tracker", () => {
    expect(view.stageLabel).toBe("Gathering your documents");
    expect(view.stageIndex).toBe(2);
  });

  it("describes the property and programme without the ZIP", () => {
    expect(view.property).toBe("412 Maple Ave, Austin TX");
    expect(view.programLabel).toBe("Conventional purchase");
  });

  it("turns a rejection into a plain sentence", () => {
    const paystub = view.conditions.find((c) => c.id === "c-paystub");
    expect(paystub?.statusLabel).toBe("Needs another: pages are cut off");
    expect(serialised).not.toContain("rejected");
  });

  it("offers no upload box for an item already under review", () => {
    // Frame 05-public-desktop draws the W-2 card with its file and no zone: the
    // borrower has done their part and is waiting on a person.
    const underReview = redactForPublic({
      ...SOURCE,
      conditions: [
        {
          id: "c-w2",
          title: "W-2s, last 2 years",
          instructions: "Your W-2 forms for 2024 and 2025.",
          status: "received",
          borrowerFacing: true,
          lastRejectionReason: null,
        },
      ],
    }).conditions[0];
    expect(underReview?.statusLabel).toBe("Received, under review");
    expect(underReview?.acceptsUploads).toBe(false);
  });

  it("labels a waived item as no longer needed, with no upload box", () => {
    const binder = view.conditions.find((c) => c.id === "c-binder");
    expect(binder?.statusLabel).toBe("No longer needed");
    expect(binder?.acceptsUploads).toBe(false);
  });

  it("stops explaining an item once it is accepted", () => {
    const photo = view.conditions.find((c) => c.id === "c-photo");
    expect(photo?.statusLabel).toBe("Accepted");
    expect(photo?.instructions).toBeNull();
    expect(photo?.acceptsUploads).toBe(false);
  });

  it("still asks for an open item", () => {
    const paystub = view.conditions.find((c) => c.id === "c-paystub");
    expect(paystub?.acceptsUploads).toBe(true);
    expect(paystub?.instructions).toBe(
      "Your two most recent pay stubs, all pages.",
    );
  });
});
