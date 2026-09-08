"use client";

import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CircleMinus,
  CircleX,
  Ellipsis,
} from "lucide-react";
import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CLOSED_REASONS,
  type ClosedReason,
  closedReasonLabel,
  isTerminalStage,
  type Stage,
  staffLabel,
  stageIndex,
} from "@/lib/stages";
import { type MoveLoanState, moveLoan } from "@/server/actions/loans";

/**
 * The card's "Move to…" menu (design frame 02-pipeline). The moves come from
 * `availableMoves()` on the server, so a loan officer simply has no forward-to-
 * underwriting item and a processor has no step below processing — and the action
 * re-checks anyway, because a Server Action accepts a direct POST.
 *
 * A move that ends the file needs a reason before it can be made, so it opens the confirm
 * rather than firing from the menu.
 */
export type AvailableMove = { to: Stage; requiresClosedReason: boolean };

/** The item's icon says which way the file is going. */
function moveIcon(from: Stage, to: Stage) {
  if (to === "withdrawn") return CircleMinus;
  if (to === "denied") return CircleX;
  if (isTerminalStage(to) || isTerminalStage(from)) return ArrowRight;
  return stageIndex(to) < stageIndex(from) ? ArrowLeft : ArrowRight;
}

/** "Move to Processing" forward, "Move back to Application" backward. */
function moveLabel(from: Stage, to: Stage): string {
  if (to === "withdrawn") return "Withdraw…";
  if (to === "denied") return "Deny…";
  const back =
    !isTerminalStage(from) &&
    !isTerminalStage(to) &&
    stageIndex(to) < stageIndex(from);
  return back ? `Move back to ${staffLabel(to)}` : `Move to ${staffLabel(to)}`;
}

export function MoveMenu({
  loanId,
  familyName,
  stage,
  moves,
  trigger = "icon",
}: {
  loanId: string;
  familyName: string;
  stage: Stage;
  moves: AvailableMove[];
  /**
   * "icon" is the 24 px ellipsis a board card has room for. "button" is the 32 px
   * labelled control a page header wants, where the menu may be the only stage action on
   * screen and an unlabelled ellipsis would read as decoration.
   */
  trigger?: "icon" | "button";
}) {
  const [closing, setClosing] = useState<Stage | null>(null);
  const reasonId = useId();
  const noteId = useId();
  const [reason, setReason] = useState<ClosedReason>("withdrawn_by_applicant");

  const [state, formAction] = useActionState<MoveLoanState, FormData>(
    async (previous, formData) => {
      const result = await moveLoan(previous, formData);
      if (result?.ok) {
        setClosing(null);
        toast.success(
          `${result.familyName} moved to ${staffLabel(result.to)}.`,
        );
        return null;
      }
      // A move made from the menu has nowhere to show a refusal; the confirm dialog does,
      // and only it sends a closed reason.
      if (result && !formData.has("closedReason")) toast.error(result.error);
      return result;
    },
    null,
  );

  if (moves.length === 0) return null;

  const submit = (to: Stage) => {
    const formData = new FormData();
    formData.set("loanId", loanId);
    formData.set("to", to);
    formAction(formData);
  };

  return (
    <>
      <DropdownMenu>
        {trigger === "button" ? (
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            Move to…
            <ChevronDown aria-hidden="true" data-icon="inline-end" />
            <span className="sr-only">
              {familyName}, out of {staffLabel(stage)}
            </span>
          </DropdownMenuTrigger>
        ) : (
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="size-6" />
            }
          >
            <Ellipsis aria-hidden="true" />
            <span className="sr-only">
              Move {familyName} out of {staffLabel(stage)}
            </span>
          </DropdownMenuTrigger>
        )}
        <DropdownMenuContent align="end">
          {/* base-ui requires a GroupLabel to sit inside its Group. */}
          <DropdownMenuGroup>
            {trigger === "icon" ? (
              <DropdownMenuLabel>Move to…</DropdownMenuLabel>
            ) : null}
            {moves
              .filter((m) => !m.requiresClosedReason)
              .map((m) => {
                const Icon = moveIcon(stage, m.to);
                return (
                  <DropdownMenuItem key={m.to} onClick={() => submit(m.to)}>
                    <Icon aria-hidden="true" />
                    {moveLabel(stage, m.to)}
                  </DropdownMenuItem>
                );
              })}
          </DropdownMenuGroup>
          {moves.some((m) => m.requiresClosedReason) ? (
            <DropdownMenuSeparator />
          ) : null}
          {moves
            .filter((m) => m.requiresClosedReason)
            .map((m) => {
              const Icon = moveIcon(stage, m.to);
              return (
                <DropdownMenuItem
                  key={m.to}
                  variant="destructive"
                  onClick={() => setClosing(m.to)}
                >
                  <Icon aria-hidden="true" />
                  {moveLabel(stage, m.to)}
                </DropdownMenuItem>
              );
            })}
        </DropdownMenuContent>
      </DropdownMenu>

      {closing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setClosing(null);
          }}
          title={
            closing === "withdrawn"
              ? `Withdraw ${familyName}?`
              : `Deny ${familyName}?`
          }
          description={`The file leaves the pipeline and stops at ${staffLabel(closing)}. It cannot be moved again, and the reason is recorded in the activity log.`}
          cancelLabel="Keep in pipeline"
          confirmLabel={closing === "withdrawn" ? "Withdraw loan" : "Deny loan"}
          pendingLabel={closing === "withdrawn" ? "Withdrawing…" : "Denying…"}
          action={formAction}
          fields={{ loanId, to: closing, closedReason: reason }}
          error={state && !state.ok ? state.error : undefined}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={reasonId}>Reason</Label>
              <Select
                value={reason}
                onValueChange={(value) => setReason(value as ClosedReason)}
              >
                <SelectTrigger id={reasonId} className="w-full">
                  <SelectValue>{closedReasonLabel(reason)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CLOSED_REASONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {closedReasonLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={noteId}>Note (optional)</Label>
              <Input
                id={noteId}
                name="reason"
                maxLength={200}
                placeholder="Buyer walked away from the contract"
              />
            </div>
          </div>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
