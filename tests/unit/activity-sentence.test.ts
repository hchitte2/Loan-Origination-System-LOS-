import { describe, expect, it } from "vitest";
import {
  type ActivityLike,
  activityActor,
  activityText,
} from "../../src/lib/activity-sentence";

/**
 * The sentences the loan Activity tab and the global log render. Pure, so both surfaces
 * are covered here rather than in a browser.
 */
function row(overrides: Partial<ActivityLike> = {}): ActivityLike {
  return {
    action: "loan.stage_changed",
    detail: { from: "application", to: "processing" },
    actorKind: "user",
    actorName: "Alex Rivera",
    onBehalfOfName: null,
    borrowerName: "Maria Chen",
    ...overrides,
  };
}

describe("activityActor", () => {
  it("names the human, and who they were viewing as", () => {
    expect(activityActor(row())).toBe("Alex Rivera");
    expect(
      activityActor(
        row({ actorName: "Priya Nair", onBehalfOfName: "Sam Okafor" }),
      ),
    ).toBe("Priya Nair (viewing as Sam Okafor)");
  });

  it("names the borrower on a public-link row and the system on a system row", () => {
    expect(
      activityActor(row({ actorKind: "public_link", actorName: null })),
    ).toBe("Maria Chen");
    expect(activityActor(row({ actorKind: "system", actorName: null }))).toBe(
      "System",
    );
  });
});

describe("activityText for a stage change", () => {
  it("names both stages with their staff labels", () => {
    expect(activityText(row())).toBe(
      "moved the loan from Application to Processing",
    );
  });

  it("appends a free-text note when one was given", () => {
    expect(
      activityText(
        row({
          detail: {
            from: "processing",
            to: "withdrawn",
            closedReason: "withdrawn_by_applicant",
            reason: "Buyer walked away",
          },
        }),
      ),
    ).toBe("moved the loan from Processing to Withdrawn: Buyer walked away");
  });

  it("falls back to the closed reason when nobody typed a note", () => {
    expect(
      activityText(
        row({
          detail: { from: "processing", to: "denied", closedReason: "credit" },
        }),
      ),
    ).toBe("moved the loan from Processing to Denied: credit");
    expect(
      activityText(
        row({
          detail: {
            from: "lead",
            to: "withdrawn",
            closedReason: "incomplete",
          },
        }),
      ),
    ).toBe("moved the loan from Lead to Withdrawn: incomplete file");
  });

  it("says nothing extra for an ordinary forward move", () => {
    expect(
      activityText(row({ detail: { from: "lead", to: "application" } })),
    ).toBe("moved the loan from Lead to Application");
  });
});
