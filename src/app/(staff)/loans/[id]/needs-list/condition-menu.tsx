"use client";

import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type ConditionState,
  deleteCondition,
} from "@/server/actions/conditions";
import type { ConditionRow } from "@/server/queries/conditions";
import { ConditionForm } from "./condition-form";

/**
 * Edit and remove, on a needs-list row (design frame 03-loan-detail). Clearing and
 * waiving arrive with documents in Phase 3.
 *
 * A resolved condition cannot be removed — the append-only log would be left describing
 * a row that no longer exists — so the item is simply absent rather than present and
 * failing.
 */
export function ConditionMenu({
  loanId,
  condition,
  borrowerFirstName,
}: {
  loanId: string;
  condition: ConditionRow;
  /** The confirm speaks the borrower's name, as the frame's confirm does. */
  borrowerFirstName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Matches deleteCondition: from `received` on, a document points at this row.
  const removable = condition.status === "requested";

  const [state, formAction] = useActionState<ConditionState, FormData>(
    async (previous, formData) => {
      const result = await deleteCondition(previous, formData);
      if (result?.ok) {
        setConfirming(false);
        toast.success(`${result.title} removed from the needs list.`);
        return null;
      }
      return result;
    },
    null,
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" className="size-6" />}
        >
          <Ellipsis aria-hidden="true" />
          <span className="sr-only">Actions for {condition.title}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            Edit condition
          </DropdownMenuItem>
          {removable ? <DropdownMenuSeparator /> : null}
          {removable ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 aria-hidden="true" />
              Remove…
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {editing ? (
        <ConditionForm
          loanId={loanId}
          condition={condition}
          open
          onOpenChange={setEditing}
        />
      ) : null}

      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirming(false);
          }}
          // The title is the question, and the name leads the description, as frame
          // 03-loan-detail-confirm does. A user-supplied title can run to 120 characters
          // and would wrap a 420 px dialog title to three lines.
          title="Remove this condition?"
          description={
            condition.borrowerFacing
              ? `${condition.title} comes off the needs list and off ${borrowerFirstName}'s page. Nothing they have already sent is deleted.`
              : `${condition.title} comes off the needs list. ${borrowerFirstName} never saw it.`
          }
          cancelLabel="Keep condition"
          confirmLabel="Remove condition"
          pendingLabel="Removing…"
          action={formAction}
          fields={{ loanId, conditionId: condition.id }}
          error={state && !state.ok ? state.error : undefined}
        />
      ) : null}
    </>
  );
}
