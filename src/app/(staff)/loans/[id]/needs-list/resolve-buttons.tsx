"use client";

import { CircleCheck, CircleMinus } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  clearCondition,
  type ResolveConditionState,
  waiveCondition,
} from "@/server/actions/conditions";
import type { ConditionRow } from "@/server/queries/conditions";

/**
 * Clearing and waiving a condition (design frame 03-loan-detail-confirm). Both are
 * irreversible from the borrower's point of view — their page changes the moment either
 * lands — so both go through the confirm, never a bare button.
 *
 * The dialogs submit real forms to Server Actions, so the button is never the control.
 */

/** The confirm on its own, so the panel can also raise it straight after an accept. */
export function ClearConditionDialog({
  loanId,
  condition,
  borrowerFirstName,
  description,
  onClose,
}: {
  loanId: string;
  condition: ConditionRow;
  borrowerFirstName: string;
  description?: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ResolveConditionState, FormData>(
    async (previous, formData) => {
      const result = await clearCondition(previous, formData);
      if (result?.ok) {
        onClose();
        toast.success(`${result.title} cleared.`);
        return null;
      }
      return result;
    },
    null,
  );

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      tone="primary"
      title="Clear this condition?"
      description={
        description ??
        `${condition.title} has an accepted document. ${borrowerFirstName} will see it as Accepted.`
      }
      cancelLabel="Keep open"
      confirmLabel="Clear condition"
      pendingLabel="Clearing…"
      action={formAction}
      fields={{ loanId, conditionId: condition.id }}
      error={state && !state.ok ? state.error : undefined}
    />
  );
}

export function ClearConditionButton({
  loanId,
  condition,
  borrowerFirstName,
}: {
  loanId: string;
  condition: ConditionRow;
  borrowerFirstName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CircleCheck aria-hidden="true" />
        Clear condition
      </Button>
      {open ? (
        <ClearConditionDialog
          loanId={loanId}
          condition={condition}
          borrowerFirstName={borrowerFirstName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function WaiveConditionButton({
  loanId,
  condition,
  borrowerFirstName,
}: {
  loanId: string;
  condition: ConditionRow;
  borrowerFirstName: string;
}) {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ResolveConditionState, FormData>(
    async (previous, formData) => {
      const result = await waiveCondition(previous, formData);
      if (result?.ok) {
        setOpen(false);
        toast.success(`${result.title} waived.`);
        return null;
      }
      return result;
    },
    null,
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CircleMinus aria-hidden="true" />
        Waive…
      </Button>
      {open ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) setOpen(false);
          }}
          title="Waive this condition?"
          description={`${condition.title} stops being asked for. ${borrowerFirstName} sees "No longer needed" and no upload box — they are not shown the reason.`}
          cancelLabel="Keep asking"
          confirmLabel="Waive condition"
          pendingLabel="Waiving…"
          action={formAction}
          fields={{ loanId, conditionId: condition.id }}
          error={state && !state.ok ? state.error : undefined}
        >
          <label htmlFor={reasonId} className="flex flex-col gap-1.5">
            <span className="text-control text-foreground">
              Reason · for the activity log
            </span>
            <Textarea
              id={reasonId}
              name="reason"
              required
              minLength={3}
              maxLength={300}
              rows={3}
              placeholder="Lender no longer requires it for this program."
            />
          </label>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
