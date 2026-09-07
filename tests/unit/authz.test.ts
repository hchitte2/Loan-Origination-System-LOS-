import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { ROLES, type Role } from "@/lib/roles";
import type { Actor } from "@/server/actor";
import {
  ACTIONS,
  assertCan,
  can,
  ForbiddenError,
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

const ownLoan = { loanOfficerId: ME };
const foreignLoan = { loanOfficerId: SOMEONE_ELSE };

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
            expect(can(actor, action)).toBe(true);
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

describe("assertCan", () => {
  it("throws ForbiddenError naming the role and action", () => {
    const sam = actorFor("processor");
    expect(() => assertCan(sam, "loan.create")).toThrow(ForbiddenError);
    expect(() => assertCan(sam, "loan.create")).toThrow(
      "processor may not loan.create",
    );
    expect(() => assertCan(sam, "document.review")).not.toThrow();
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
