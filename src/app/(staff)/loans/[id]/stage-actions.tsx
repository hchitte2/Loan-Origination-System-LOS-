"use client";

import { ArrowRight } from "lucide-react";
import { useActionState } from "react";
import { toast } from "sonner";
import { MoveMenu } from "@/components/move-menu";
import { SubmitButton } from "@/components/submit-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isTerminalStage, type Stage, staffLabel } from "@/lib/stages";
import { type MoveLoanState, moveLoan } from "@/server/actions/loans";
import type { DescribedMove } from "@/server/transitions";

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
  conditional_approval: "Issue conditional approval",
  clear_to_close: "Issue clear to close",
  funded: "Mark funded",
  withdrawn: "Withdraw",
  denied: "Deny",
  lead: "Move back to Lead",
} as const satisfies Record<Stage, string>;

const PENDING: Partial<Record<Stage, string>> = {
  application: "Taking…",
  processing: "Starting…",
  underwriting: "Submitting…",
  conditional_approval: "Issuing…",
  clear_to_close: "Issuing…",
  funded: "Marking…",
};

const TOOLTIPS: Partial<Record<Stage, string>> = {
  underwriting: "In production an underwriter performs the next step.",
  conditional_approval:
    "In production an underwriter issues this approval and its conditions.",
  funded: "In production a closer disburses the loan and marks it funded.",
};

/**
 * The one move that carries the file forward, if this actor has one — blocked or not.
 * A gated step is still shown, refused, with the gate's own sentence: the processor came
 * to this page for that button, and silence about why it is missing is worse than the
 * refusal.
 */
function forwardMove(
  stage: Stage,
  moves: DescribedMove[],
): DescribedMove | undefined {
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

/**
 * A gated step is refused but stays reachable: `disabled` would take the button out of
 * the hover and focus order, and with it the tooltip that says why it is refused. The
 * server refuses the move regardless — this is the affordance, not the control.
 */
function blockedProps(blockedBy: string | null) {
  if (blockedBy === null) return {};
  return {
    "aria-disabled": true,
    className: "opacity-50",
    onClick: (event: React.MouseEvent) => event.preventDefault(),
  };
}

export function StageActions({
  loanId,
  familyName,
  stage,
  moves,
}: {
  loanId: string;
  familyName: string;
  stage: Stage;
  moves: DescribedMove[];
}) {
  const forward = forwardMove(stage, moves);
  // The menu keeps only what can actually be done now.
  const rest = moves.filter(
    (move) => move.to !== forward?.to && move.blockedBy === null,
  );

  const [, formAction] = useActionState<MoveLoanState, FormData>(
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
  // A blocked step explains itself; an available one explains the folded role.
  const tooltip = forward
    ? (forward.blockedBy ?? TOOLTIPS[forward.to])
    : undefined;

  // The button itself is the tooltip trigger. Wrapping it in a span would put
  // `aria-describedby` on the span while focus lands on the button, and the description
  // is not inherited — a screen-reader user would never hear the sentence that explains
  // why a processor is pressing an underwriter's button.
  const submit = forward ? (
    <SubmitButton
      type="submit"
      {...blockedProps(forward.blockedBy)}
      pendingLabel={PENDING[forward.to] ?? "Moving…"}
    >
      {LABELS[forward.to]}
      <ArrowRight aria-hidden="true" data-icon="inline-end" />
    </SubmitButton>
  ) : null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {forward ? (
        <form action={formAction}>
          <input type="hidden" name="loanId" value={loanId} />
          <input type="hidden" name="to" value={forward.to} />
          {tooltip ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <SubmitButton
                    type="submit"
                    {...blockedProps(forward.blockedBy)}
                    pendingLabel={PENDING[forward.to] ?? "Moving…"}
                  />
                }
              >
                {LABELS[forward.to]}
                <ArrowRight aria-hidden="true" data-icon="inline-end" />
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          ) : (
            submit
          )}
        </form>
      ) : null}
      {rest.length > 0 ? (
        <MoveMenu
          loanId={loanId}
          familyName={familyName}
          stage={stage}
          moves={rest}
          trigger="button"
        />
      ) : null}
    </div>
  );
}
