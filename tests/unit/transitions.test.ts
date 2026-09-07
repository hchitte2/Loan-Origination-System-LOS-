import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/roles";
import { ACTIVE_STAGES, STAGES, type Stage } from "@/lib/stages";
import type { Actor } from "@/server/actor";
import {
  availableMoves,
  type ConditionForGate,
  checkMove,
  type LoanForMove,
  move,
} from "@/server/transitions";

const ME = "user_me";
const OTHER = "user_other";
const NOW = new Date("2026-09-06T15:00:00.000Z");

function actorFor(role: Role, userId = ME): Actor {
  return {
    userId,
    role,
    name: "Test",
    email: "test@example.com",
    actorUserId: userId,
    impersonating: false,
  };
}

function loanIn(stage: Stage, loanOfficerId = ME): LoanForMove {
  return { stage, loanOfficerId, applicationDate: null };
}

const allCleared: ConditionForGate[] = [
  { status: "cleared", priorTo: "docs" },
  { status: "waived", priorTo: "approval" },
  { status: "cleared", priorTo: "funding" },
];

/** The allowed moves per role, transcribed from PLAN.md §2 and §6 invariant 1. */
const EARLY: [Stage, Stage][] = [
  ["lead", "application"],
  ["application", "lead"],
  ["application", "processing"],
  ["processing", "application"],
  ...ACTIVE_STAGES.map((s): [Stage, Stage] => [s, "withdrawn"]),
];
const LATE: [Stage, Stage][] = [
  ["processing", "underwriting"],
  ["underwriting", "conditional_approval"],
  ["conditional_approval", "clear_to_close"],
  ["clear_to_close", "funded"],
  ["underwriting", "processing"],
  ["conditional_approval", "underwriting"],
  ["clear_to_close", "conditional_approval"],
  ...ACTIVE_STAGES.map((s): [Stage, Stage] => [s, "denied"]),
];
const ALLOWED: Record<Role, Set<string>> = {
  loan_officer: new Set(EARLY.map(([f, t]) => `${f}>${t}`)),
  processor: new Set(LATE.map(([f, t]) => `${f}>${t}`)),
  superadmin: new Set([...EARLY, ...LATE].map(([f, t]) => `${f}>${t}`)),
};

describe("every from × to × role, gates satisfied and a reason supplied", () => {
  for (const role of ["loan_officer", "processor", "superadmin"] as const) {
    for (const from of STAGES) {
      for (const to of STAGES) {
        const allowed = ALLOWED[role].has(`${from}>${to}`);
        it(`${role}: ${from} → ${to} is ${allowed ? "allowed" : "refused"}`, () => {
          const result = move({
            loan: loanIn(from),
            to,
            actor: actorFor(role),
            conditions: allCleared,
            closedReason: "other",
            now: NOW,
          });
          expect(result.ok).toBe(allowed);
        });
      }
    }
  }
});

describe("ownership", () => {
  it("a loan officer cannot move another officer's loan", () => {
    const result = move({
      loan: loanIn("lead", OTHER),
      to: "application",
      actor: actorFor("loan_officer"),
      conditions: [],
    });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/cannot move/);
  });

  it("a processor and the superadmin move anyone's loan", () => {
    for (const role of ["processor", "superadmin"] as const) {
      const result = move({
        loan: loanIn("processing", OTHER),
        to: "underwriting",
        actor: actorFor(role),
        conditions: [],
      });
      expect(result.ok).toBe(true);
    }
  });
});

describe("reasons", () => {
  it("withdrawn and denied need a closed reason and record it", () => {
    for (const [role, to] of [
      ["loan_officer", "withdrawn"],
      ["processor", "denied"],
    ] as const) {
      const without = move({
        loan: loanIn("processing"),
        to,
        actor: actorFor(role),
        conditions: [],
      });
      expect(without).toMatchObject({ ok: false, error: /needs a reason/ });

      const withReason = move({
        loan: loanIn("processing"),
        to,
        actor: actorFor(role),
        conditions: [],
        closedReason: "incomplete",
        reason: "  Borrower stopped responding.  ",
        now: NOW,
      });
      expect(withReason).toEqual({
        ok: true,
        patch: { stage: to, stageEnteredAt: NOW, closedReason: "incomplete" },
        detail: {
          from: "processing",
          to,
          closedReason: "incomplete",
          reason: "Borrower stopped responding.",
        },
      });
    }
  });

  it("an active move records only from and to when no note is given", () => {
    const result = move({
      loan: {
        stage: "application",
        loanOfficerId: ME,
        applicationDate: "2026-08-01",
      },
      to: "processing",
      actor: actorFor("loan_officer"),
      conditions: [],
      now: NOW,
    });
    expect(result).toEqual({
      ok: true,
      patch: { stage: "processing", stageEnteredAt: NOW },
      detail: { from: "application", to: "processing" },
    });
  });
});

describe("dates", () => {
  it("entering application sets applicationDate only when empty", () => {
    const fresh = move({
      loan: loanIn("lead"),
      to: "application",
      actor: actorFor("loan_officer"),
      conditions: [],
      now: NOW,
    });
    expect(fresh).toMatchObject({
      ok: true,
      patch: { applicationDate: "2026-09-06" },
    });

    const back = move({
      loan: {
        stage: "processing",
        loanOfficerId: ME,
        applicationDate: "2026-08-20",
      },
      to: "application",
      actor: actorFor("loan_officer"),
      conditions: [],
      now: NOW,
    });
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.patch.applicationDate).toBeUndefined();
  });

  it("funded sets fundedAt and resets stageEnteredAt", () => {
    const result = move({
      loan: loanIn("clear_to_close"),
      to: "funded",
      actor: actorFor("processor"),
      conditions: allCleared,
      now: NOW,
    });
    expect(result).toEqual({
      ok: true,
      patch: { stage: "funded", stageEnteredAt: NOW, fundedAt: NOW },
      detail: { from: "clear_to_close", to: "funded" },
    });
  });
});

describe("gates", () => {
  const sam = actorFor("processor");

  it("clear to close is blocked by open approval or docs conditions, not funding ones", () => {
    const blocked = checkMove(
      loanIn("conditional_approval"),
      "clear_to_close",
      sam,
      [
        { status: "requested", priorTo: "docs" },
        { status: "received", priorTo: "approval" },
      ],
    );
    expect(blocked).toMatchObject({ ok: false, error: /2 still open/ });

    const insuranceOnly = checkMove(
      loanIn("conditional_approval"),
      "clear_to_close",
      sam,
      [
        { status: "requested", priorTo: "funding" },
        { status: "cleared", priorTo: "docs" },
      ],
    );
    expect(insuranceOnly.ok).toBe(true);
  });

  it("funded needs every condition cleared or waived", () => {
    const blocked = checkMove(loanIn("clear_to_close"), "funded", sam, [
      { status: "requested", priorTo: "funding" },
    ]);
    expect(blocked).toMatchObject({ ok: false, error: /1 still open/ });

    const open = checkMove(loanIn("clear_to_close"), "funded", sam, [
      { status: "waived", priorTo: "funding" },
      { status: "cleared", priorTo: "docs" },
    ]);
    expect(open.ok).toBe(true);
  });

  it("funded is refused from anywhere but clear to close, even with no conditions", () => {
    for (const from of [
      "processing",
      "underwriting",
      "conditional_approval",
    ] as const) {
      expect(checkMove(loanIn(from), "funded", sam, []).ok).toBe(false);
    }
  });
});

describe("terminal loans and no-op moves", () => {
  it("never move again", () => {
    for (const from of ["funded", "withdrawn", "denied"] as const) {
      for (const to of STAGES) {
        expect(checkMove(loanIn(from), to, actorFor("superadmin"), []).ok).toBe(
          false,
        );
      }
    }
  });

  it("refuse moving to the current stage", () => {
    const result = checkMove(
      loanIn("lead"),
      "lead",
      actorFor("superadmin"),
      [],
    );
    expect(result).toMatchObject({ ok: false, error: /already in Lead/ });
  });
});

describe("availableMoves", () => {
  it("lists a loan officer's options on a processing loan: back to Application, or withdraw", () => {
    expect(
      availableMoves(loanIn("processing"), actorFor("loan_officer"), []),
    ).toEqual([
      { to: "application", requiresClosedReason: false },
      { to: "withdrawn", requiresClosedReason: true },
    ]);
  });

  it("lists a processor's options on a clear-to-close loan, hiding a gated funding", () => {
    const open = [{ status: "requested", priorTo: "funding" } as const];
    expect(
      availableMoves(loanIn("clear_to_close"), actorFor("processor"), open),
    ).toEqual([
      { to: "conditional_approval", requiresClosedReason: false },
      { to: "denied", requiresClosedReason: true },
    ]);
    expect(
      availableMoves(
        loanIn("clear_to_close"),
        actorFor("processor"),
        allCleared,
      ),
    ).toEqual([
      { to: "conditional_approval", requiresClosedReason: false },
      { to: "funded", requiresClosedReason: false },
      { to: "denied", requiresClosedReason: true },
    ]);
  });

  it("is empty for terminal loans", () => {
    expect(
      availableMoves(loanIn("funded"), actorFor("superadmin"), []),
    ).toEqual([]);
  });
});
