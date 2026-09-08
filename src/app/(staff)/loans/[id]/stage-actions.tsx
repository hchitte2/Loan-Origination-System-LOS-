"use client";

import { ArrowRight } from "lucide-react";
import { useActionState } from "react";
import { toast } from "sonner";
import type { AvailableMove } from "@/components/move-menu";
import { MoveMenu } from "@/components/move-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isTerminalStage, type Stage, staffLabel } from "@/lib/stages";
import { type MoveLoanState, moveLoan } from "@/server/actions/loans";

/**
 * The loan's one primary action (design frame 03-loan-detail): the step this file takes
 * next, named the way the trade names it. Everything else — a step back, withdrawing,
 * denying — stays in the "Move to…" menu beside it, because the shell allows one primary
 * action per screen.
 *
 * Underwriter and closer are real jobs that this demo folds into the processor (domain
 * skill, "Roles folded for the demo"). Where a button stands in for one of them it says
 * so in a tooltip, rather than quietly implying a processor approves their own files.
 */
const LABELS = {
  application: "Take the application",
  processing: "Start processing",
  underwriting: "Submit to underwriting",
  conditional_approval: "Return conditions",
  clear_to_close: "Clear to close",
  funded: "Mark funded",
  withdrawn: "Withdraw",
  denied: "Deny",
  lead: "Move back to Lead",
} as const satisfies Record<Stage, string>;

const TOOLTIPS: Partial<Record<Stage, string>> = {
  underwriting: "In production an underwriter performs the next step.",
  conditional_approval:
    "In production an underwriter returns these conditions.",
  funded: "In production a closer disburses the loan and marks it funded.",
};

/** The one move that carries the file forward, if this actor has one. */
function forwardMove(
  stage: Stage,
  moves: AvailableMove[],
): AvailableMove | undefined {
  if (isTerminalStage(stage)) return undefined;
  return moves.find(
    (move) => !move.requiresClosedReason && isForward(stage, move.to),
  );
}

function isForward(from: Stage, to: Stage): boolean {
  if (to === "funded") return true;
  if (isTerminalStage(to)) return false;
  return ORDER.indexOf(to) > ORDER.indexOf(from);
}

const ORDER: Stage[] = [
  "lead",
  "application",
  "processing",
  "underwriting",
  "conditional_approval",
  "clear_to_close",
  "funded",
];

export function StageActions({
  loanId,
  familyName,
  stage,
  moves,
}: {
  loanId: string;
  familyName: string;
  stage: Stage;
  moves: AvailableMove[];
}) {
  const forward = forwardMove(stage, moves);
  const rest = moves.filter((move) => move.to !== forward?.to);

  const [, formAction, pending] = useActionState<MoveLoanState, FormData>(
    async (previous, formData) => {
      const result = await moveLoan(previous, formData);
      if (result?.ok) {
        toast.success(
          `${result.familyName} moved to ${staffLabel(result.to)}.`,
        );
        return null;
      }
      if (result) toast.error(result.error);
      return result;
    },
    null,
  );

  if (moves.length === 0) return null;
  const tooltip = forward ? TOOLTIPS[forward.to] : undefined;

  const button = forward ? (
    <form action={formAction}>
      <input type="hidden" name="loanId" value={loanId} />
      <input type="hidden" name="to" value={forward.to} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {LABELS[forward.to]}
        <ArrowRight aria-hidden="true" data-icon="inline-end" />
      </Button>
    </form>
  ) : null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {button && tooltip ? (
        <Tooltip>
          <TooltipTrigger render={<span />}>{button}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
      {rest.length > 0 ? (
        <MoveMenu
          loanId={loanId}
          familyName={familyName}
          stage={stage}
          moves={rest}
        />
      ) : null}
    </div>
  );
}
