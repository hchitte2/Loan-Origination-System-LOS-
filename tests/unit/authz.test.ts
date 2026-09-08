import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { ROLES, type Role } from "@/lib/roles";
import { STAGES, TERMINAL_STAGES } from "@/lib/stages";
import type { Actor } from "@/server/actor";
import {
  ACTIONS,
  assertCan,
  can,
  ForbiddenError,
  isLoanWrite,
  LOAN_WRITE_ACTIONS,
  loanScope,
  POLICY,
} from "@/server/authz";

/**
 * Driven from POLICY itself: every role × action cell is exercised against an owned and
 * a foreign loan, so the table in authz.ts is the fixture and cannot drift from the tests.
 * The hand-written cases below pin the sentences of PLAN.md §2 that the table encodes.
 */

const ME = "user_me";
const SOMEONE_ELSE = "user_other";
const PRIYA = "user_priya";

function actorFor(role: Role, overrides: Partial<Actor> = {}): Actor {
  return {
    userId: ME,
    role,
    name: "Test User",
    email: "test@example.com",
    actorUserId: ME,
    impersonating: false,
    ...overrides,
  };
}

/** An open loan: the terminal check in `can()` passes, so the matrix cell decides. */
const ownLoan = { loanOfficerId: ME, stage: "processing" } as const;
const foreignLoan = {
  loanOfficerId: SOMEONE_ELSE,
  stage: "processing",
} as const;

describe("POLICY shape", () => {
  it("has one row per matrix row and one cell per role", () => {
    expect(ACTIONS).toHaveLength(25);
    for (const role of ROLES) {
      expect(Object.keys(POLICY[role]).sort()).toEqual([...ACTIONS].sort());
    }
  });
});

describe("can() follows every cell of POLICY", () => {
  for (const role of ROLES) {
    for (const action of ACTIONS) {
      const cell = POLICY[role][action];
      it(`${role} × ${action} = ${String(cell)}`, () => {
        const actor = actorFor(role);
        switch (cell) {
          case "any":
            expect(can(actor, action, ownLoan)).toBe(true);
            expect(can(actor, action, foreignLoan)).toBe(true);
            // A loan write needs the loan to check the stage against, so an "any" cell
            // is still refused without one (PLAN.md §6 invariant 8).
            expect(can(actor, action)).toBe(!isLoanWrite(action));
            break;
          case "own":
            expect(can(actor, action, ownLoan)).toBe(true);
            expect(can(actor, action, foreignLoan)).toBe(false);
            // An "own" cell without a loan can never be resolved, so it is refused.
            expect(can(actor, action)).toBe(false);
            break;
          case false:
            expect(can(actor, action, ownLoan)).toBe(false);
            expect(can(actor, action, foreignLoan)).toBe(false);
            expect(can(actor, action)).toBe(false);
            break;
        }
      });
    }
  }
});

describe("sentences from PLAN.md §2", () => {
  it("loan officers edit only their own loans but see the whole pipeline", () => {
    const alex = actorFor("loan_officer");
    expect(can(alex, "loan.read", foreignLoan)).toBe(true);
    expect(can(alex, "loan.edit_facts", foreignLoan)).toBe(false);
    expect(can(alex, "loan.edit_facts", ownLoan)).toBe(true);
  });

  it("loan officers move early stages on their own loans and never the late ones", () => {
    const alex = actorFor("loan_officer");
    expect(can(alex, "loan.move_early", ownLoan)).toBe(true);
    expect(can(alex, "loan.move_late", ownLoan)).toBe(false);
  });

  it("processors work the shared desk: late stage moves, clear, waive, review; never create", () => {
    const sam = actorFor("processor");
    expect(can(sam, "loan.move_late", foreignLoan)).toBe(true);
    expect(can(sam, "condition.resolve", foreignLoan)).toBe(true);
    expect(can(sam, "document.review", foreignLoan)).toBe(true);
    expect(can(sam, "loan.create")).toBe(false);
    expect(can(sam, "loan.move_early", foreignLoan)).toBe(false);
  });

  it("only the superadmin manages users, reads the global log and resets the demo", () => {
    for (const role of ["loan_officer", "processor"] as const) {
      expect(can(actorFor(role), "admin.manage_users")).toBe(false);
      expect(can(actorFor(role), "admin.read_activity")).toBe(false);
      expect(can(actorFor(role), "admin.reset_demo")).toBe(false);
    }
    const priya = actorFor("superadmin");
    expect(can(priya, "admin.manage_users")).toBe(true);
    expect(can(priya, "admin.read_activity")).toBe(true);
    expect(can(priya, "admin.reset_demo")).toBe(true);
  });

  it("an impersonating superadmin inherits exactly the target's column", () => {
    const priyaAsSam = actorFor("processor", {
      actorUserId: PRIYA,
      impersonating: true,
    });
    for (const action of ACTIONS) {
      expect(can(priyaAsSam, action, ownLoan)).toBe(
        can(actorFor("processor"), action, ownLoan),
      );
    }
    expect(can(priyaAsSam, "admin.manage_users")).toBe(false);
  });
});

describe("terminal loans are read-only (PLAN.md §6 invariant 8)", () => {
  const openLoan = (officer: string) =>
    ({ loanOfficerId: officer, stage: "processing" }) as const;

  it("refuses every loan write on every terminal stage, for every role", () => {
    for (const stage of TERMINAL_STAGES) {
      for (const role of ROLES) {
        const actor = actorFor(role);
        for (const action of LOAN_WRITE_ACTIONS) {
          // The owned loan is the strongest case: an "own" cell would allow it, and a
          // superadmin's whole column is "any". The stage refuses both.
          expect(can(actor, action, { loanOfficerId: ME, stage })).toBe(false);
        }
      }
    }
  });

  it("still lets every role read a closed loan", () => {
    const readActions = ACTIONS.filter((a) => !isLoanWrite(a));
    for (const stage of TERMINAL_STAGES) {
      for (const action of readActions) {
        const priya = actorFor("superadmin");
        expect(can(priya, action, { loanOfficerId: ME, stage })).toBe(
          POLICY.superadmin[action] !== false,
        );
      }
    }
  });

  it("leaves the six active stages to the matrix", () => {
    const active = STAGES.filter((s) => !TERMINAL_STAGES.includes(s as never));
    for (const stage of active) {
      const sam = actorFor("processor");
      expect(can(sam, "document.review", { loanOfficerId: ME, stage })).toBe(
        true,
      );
      expect(can(sam, "condition.resolve", { loanOfficerId: ME, stage })).toBe(
        true,
      );
    }
    expect(active).toHaveLength(6);
  });

  it("names every write action that a stage can close", () => {
    // A new write action must be listed, or a closed loan would still accept it. The
    // ones deliberately absent have no loan to be terminal.
    const notLoanScoped = [
      "loan.create",
      "admin.manage_users",
      "admin.reset_demo",
    ];
    const reads = [
      "loan.read",
      "loan.read_loan_officer",
      "loan.read_stage",
      "condition.read",
      "document.download",
      "activity.read_loan",
      "admin.read_activity",
      "analytics.view",
    ];
    expect([...LOAN_WRITE_ACTIONS].sort()).toEqual(
      ACTIONS.filter(
        (a) => !notLoanScoped.includes(a) && !reads.includes(a),
      ).sort(),
    );
  });

  it("refuses a loan write that arrives without a loan, whatever the cell says", () => {
    for (const role of ROLES) {
      for (const action of LOAN_WRITE_ACTIONS) {
        expect(can(actorFor(role), action)).toBe(false);
      }
    }
    // The open loan is the control: the same calls pass once the loan is in hand.
    expect(can(actorFor("superadmin"), "document.review", openLoan(ME))).toBe(
      true,
    );
  });
});

describe("assertCan", () => {
  it("throws ForbiddenError naming the role and action", () => {
    const sam = actorFor("processor");
    expect(() => assertCan(sam, "loan.create")).toThrow(ForbiddenError);
    expect(() => assertCan(sam, "loan.create")).toThrow(
      "processor may not loan.create",
    );
    expect(() => assertCan(sam, "document.review", ownLoan)).not.toThrow();
  });
});

describe("loanScope", () => {
  const dialect = new PgDialect();
  const render = (actor: Actor, mode: "read" | "write") => {
    const scope = loanScope(actor, mode);
    return scope ? dialect.sqlToQuery(scope) : undefined;
  };

  it("reads are unfiltered for every staff role", () => {
    for (const role of ROLES) {
      expect(render(actorFor(role), "read")).toBeUndefined();
    }
  });

  it("writes: superadmin any loan, loan officer own loans, processor active loans", () => {
    expect(render(actorFor("superadmin"), "write")).toBeUndefined();

    const lo = render(actorFor("loan_officer"), "write");
    expect(lo?.sql).toContain('"loans"."loan_officer_id" = ');
    expect(lo?.params).toEqual([ME]);

    const processor = render(actorFor("processor"), "write");
    expect(processor?.sql).toContain('"loans"."stage" in ');
    expect(processor?.params).toEqual([
      "lead",
      "application",
      "processing",
      "underwriting",
      "conditional_approval",
      "clear_to_close",
    ]);
  });
});
