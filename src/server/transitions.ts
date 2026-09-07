import {
  type ConditionStatus,
  isOpenCondition,
  type PriorTo,
} from "@/lib/conditions";
import {
  ACTIVE_STAGES,
  type ClosedReason,
  isActiveStage,
  isTerminalStage,
  type Stage,
  staffLabel,
  stageIndex,
} from "@/lib/stages";
import type { Actor } from "./actor";
import { type Action, can } from "./authz";

/**
 * The stage machine (PLAN.md §6 invariants 1 and 2). Pure: it decides, the action layer
 * writes. Nothing else may assign `loans.stage`.
 *
 * - Moves step one column forward or back among the six active stages. Loan officers
 *   move `lead ↔ application ↔ processing` and may withdraw; processors move
 *   `processing → underwriting → conditional_approval → clear_to_close → funded`, one
 *   step back but never below `processing`, and may deny. The superadmin may do both.
 * - `withdrawn` and `denied` need a `closedReason`. `funded` only from `clear_to_close`.
 *   Terminal stages never move.
 * - Entering `clear_to_close` needs no open condition due before approval or docs;
 *   entering `funded` needs every condition cleared or waived.
 * - Entering `application` sets `applicationDate` if empty; `funded` sets `fundedAt`;
 *   every move resets `stageEnteredAt` and records one `loan.stage_changed` row.
 */

export type LoanForMove = {
  stage: Stage;
  loanOfficerId: string;
  applicationDate: string | null;
};

export type ConditionForGate = {
  status: ConditionStatus;
  priorTo: PriorTo;
};

/** The columns a successful move writes. */
export type StagePatch = {
  stage: Stage;
  stageEnteredAt: Date;
  applicationDate?: string;
  fundedAt?: Date;
  closedReason?: ClosedReason;
};

export type StageChangeDetail = {
  from: Stage;
  to: Stage;
  closedReason?: ClosedReason;
  reason?: string;
};

export type MoveCheck =
  | { ok: true; action: Action; requiresClosedReason: boolean }
  | { ok: false; error: string };

export type MoveResult =
  | { ok: true; patch: StagePatch; detail: StageChangeDetail }
  | { ok: false; error: string };

/** Which matrix row a move falls under, or null when the geometry itself is wrong. */
function actionFor(from: Stage, to: Stage): Action | null {
  if (!isActiveStage(from)) return null;
  if (to === "withdrawn") return "loan.move_early";
  if (to === "denied") return "loan.move_late";
  if (to === "funded")
    return from === "clear_to_close" ? "loan.move_late" : null;
  if (!isActiveStage(to)) return null;
  const fromIndex = stageIndex(from);
  const toIndex = stageIndex(to);
  if (Math.abs(fromIndex - toIndex) !== 1) return null;
  // The loan officer's territory ends at processing; every step at or beyond it is the
  // processor's. A step back to processing from underwriting is still a late move.
  const processing = stageIndex("processing");
  const early = fromIndex <= processing && toIndex <= processing;
  return early ? "loan.move_early" : "loan.move_late";
}

function gateFor(
  to: Stage,
  conditions: readonly ConditionForGate[],
): string | null {
  if (to === "clear_to_close") {
    const blocking = conditions.filter(
      (c) => isOpenCondition(c.status) && c.priorTo !== "funding",
    ).length;
    if (blocking > 0) {
      return `Clear to close needs every condition due before approval or docs cleared or waived; ${blocking} still open.`;
    }
  }
  if (to === "funded") {
    const open = conditions.filter((c) => isOpenCondition(c.status)).length;
    if (open > 0) {
      return `Funding needs every condition cleared or waived; ${open} still open.`;
    }
  }
  return null;
}

/**
 * Can this actor move this loan to `to`? Checks geometry, permission and gates, but not
 * whether a reason was supplied, so menus can show what a move will ask for.
 */
export function checkMove(
  loan: LoanForMove,
  to: Stage,
  actor: Actor,
  conditions: readonly ConditionForGate[],
): MoveCheck {
  if (isTerminalStage(loan.stage)) {
    return {
      ok: false,
      error: `This loan is ${staffLabel(loan.stage).toLowerCase()} and cannot move.`,
    };
  }
  if (to === loan.stage) {
    return { ok: false, error: `The loan is already in ${staffLabel(to)}.` };
  }
  const action = actionFor(loan.stage, to);
  if (!action) {
    return {
      ok: false,
      error: `A loan cannot move from ${staffLabel(loan.stage)} to ${staffLabel(to)}.`,
    };
  }
  if (!can(actor, action, loan)) {
    return {
      ok: false,
      error: `You cannot move this loan to ${staffLabel(to)}.`,
    };
  }
  const gate = gateFor(to, conditions);
  if (gate) return { ok: false, error: gate };
  return {
    ok: true,
    action,
    requiresClosedReason: isTerminalStage(to) && to !== "funded",
  };
}

export type MoveInput = {
  loan: LoanForMove;
  to: Stage;
  actor: Actor;
  conditions: readonly ConditionForGate[];
  /** Required for withdrawn and denied. */
  closedReason?: ClosedReason;
  /** Optional free-text note shown in the activity sentence. */
  reason?: string;
  now?: Date;
};

/** Decide a move and describe the write. The caller applies the patch and logs the detail. */
export function move(input: MoveInput): MoveResult {
  const { loan, to, actor, conditions, closedReason, reason } = input;
  const now = input.now ?? new Date();
  const check = checkMove(loan, to, actor, conditions);
  if (!check.ok) return check;
  if (check.requiresClosedReason && !closedReason) {
    return {
      ok: false,
      error: `Moving to ${staffLabel(to)} needs a reason.`,
    };
  }
  const patch: StagePatch = { stage: to, stageEnteredAt: now };
  if (to === "application" && !loan.applicationDate) {
    patch.applicationDate = now.toISOString().slice(0, 10);
  }
  if (to === "funded") patch.fundedAt = now;
  if (check.requiresClosedReason && closedReason)
    patch.closedReason = closedReason;

  const detail: StageChangeDetail = { from: loan.stage, to };
  if (patch.closedReason) detail.closedReason = patch.closedReason;
  const note = reason?.trim();
  if (note) detail.reason = note;
  return { ok: true, patch, detail };
}

/** Every stage this actor could move the loan to right now, for the "Move to…" menu. */
export function availableMoves(
  loan: LoanForMove,
  actor: Actor,
  conditions: readonly ConditionForGate[],
): { to: Stage; requiresClosedReason: boolean }[] {
  if (isTerminalStage(loan.stage)) return [];
  const targets: Stage[] = [...ACTIVE_STAGES, "funded", "withdrawn", "denied"];
  const moves: { to: Stage; requiresClosedReason: boolean }[] = [];
  for (const to of targets) {
    const check = checkMove(loan, to, actor, conditions);
    if (check.ok)
      moves.push({ to, requiresClosedReason: check.requiresClosedReason });
  }
  return moves;
}
