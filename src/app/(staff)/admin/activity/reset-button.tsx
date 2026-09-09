"use client";

import { RotateCcw } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { type ResetDemoState, resetDemoData } from "@/server/actions/admin";

/**
 * "Reset demo data" and its confirm (design frame 07-reset-confirm).
 *
 * Destructive-outline in the header, solid destructive in the dialog: the second press is
 * the one that destroys something, so it is the one that looks like it. The dialog says
 * what goes rather than asking whether the visitor is sure — "Visitors' changes from
 * today are lost" is the sentence someone needs before pressing it during a demo.
 *
 * The ten-minute interval is the action's, not this component's. A disabled button would
 * be a suggestion; the refusal comes back into the dialog as a sentence.
 */
export function ResetDemoButton() {
  const [confirming, setConfirming] = useState(false);

  const [state, formAction] = useActionState<ResetDemoState, FormData>(
    async (previous, formData) => {
      const result = await resetDemoData(previous, formData);
      if (result?.ok) {
        setConfirming(false);
        toast.success("Demo data restored. Uploaded files are gone.");
        return null;
      }
      return result;
    },
    null,
  );

  return (
    <>
      <Button
        variant="outline"
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <RotateCcw aria-hidden="true" className="size-4" />
        Reset demo data
      </Button>

      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirming(false);
          }}
          title="Reset demo data?"
          description="This restores the sample data and removes uploaded files. Visitors' changes from today are lost."
          cancelLabel="Keep current data"
          confirmLabel="Reset demo data"
          pendingLabel="Resetting…"
          action={formAction}
          error={state && !state.ok ? state.error : undefined}
        />
      ) : null}
    </>
  );
}
