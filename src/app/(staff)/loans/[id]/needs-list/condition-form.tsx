"use client";

import { Plus } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  conditionStaffLabel,
  PRIOR_TO,
  type PriorTo,
  priorToLabel,
} from "@/lib/conditions";
import {
  addCondition,
  type ConditionState,
  editCondition,
} from "@/server/actions/conditions";
import type { ConditionRow } from "@/server/queries/conditions";

/**
 * Add or edit one needs-list item. The instructions are what the borrower reads on their
 * page, so the field says so and the copy voice shifts there: the title is for staff,
 * the instructions are for Maria.
 *
 * `condition` present means edit; absent means add.
 */
export function ConditionForm({
  loanId,
  condition,
  open,
  onOpenChange,
}: {
  loanId: string;
  condition?: ConditionRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = condition !== undefined;
  const ids = {
    title: useId(),
    instructions: useId(),
    priorTo: useId(),
    borrowerFacing: useId(),
    instructionsHelp: useId(),
  };
  const [priorTo, setPriorTo] = useState<PriorTo>(condition?.priorTo ?? "docs");
  const [borrowerFacing, setBorrowerFacing] = useState(
    condition?.borrowerFacing ?? true,
  );

  const [state, formAction] = useActionState<ConditionState, FormData>(
    async (previous, formData) => {
      const result = editing
        ? await editCondition(previous, formData)
        : await addCondition(previous, formData);
      if (result?.ok) {
        onOpenChange(false);
        toast.success(
          editing ? `${result.title} updated.` : `${result.title} added.`,
        );
        return null;
      }
      if (result && !result.ok && result.error) toast.error(result.error);
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.errors : {};
  const errorCount = Object.keys(errors).length;
  const describedBy = (
    id: string,
    field: keyof typeof errors,
    hint?: string,
  ) => (errors[field] ? `${id}-error` : hint);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-dialog-form">
        <form action={formAction} className="contents" noValidate>
          {/* A failed submit is announced, not only painted. */}
          <p role="status" aria-live="polite" className="sr-only">
            {errorCount > 0
              ? `The condition was not ${editing ? "saved" : "added"}. ${errorCount} ${errorCount === 1 ? "field needs" : "fields need"} attention.`
              : ""}
          </p>
          <input type="hidden" name="loanId" value={loanId} />
          {editing ? (
            <input type="hidden" name="conditionId" value={condition.id} />
          ) : null}
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit condition" : "Add condition"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Changes reach the borrower's page as soon as you save."
                : `It joins this loan's needs list as ${conditionStaffLabel("requested")}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field id={ids.title} label="Condition" error={errors.title}>
              <Input
                id={ids.title}
                name="title"
                required
                defaultValue={condition?.title}
                placeholder="Gift letter"
                autoComplete="off"
                aria-describedby={describedBy(ids.title, "title")}
                aria-invalid={errors.title ? true : undefined}
              />
            </Field>

            <Field
              id={ids.instructions}
              label="What the borrower reads"
              error={errors.instructions}
              hint="Plain and warm: “A signed letter from whoever is gifting the funds.”"
              hintId={ids.instructionsHelp}
            >
              <Textarea
                id={ids.instructions}
                name="instructions"
                rows={3}
                maxLength={400}
                defaultValue={condition?.instructions ?? ""}
                aria-describedby={describedBy(
                  ids.instructions,
                  "instructions",
                  ids.instructionsHelp,
                )}
                aria-invalid={errors.instructions ? true : undefined}
              />
            </Field>

            <Field id={ids.priorTo} label="Due" error={errors.priorTo}>
              <input type="hidden" name="priorTo" value={priorTo} />
              <Select
                value={priorTo}
                onValueChange={(value) => setPriorTo(value as PriorTo)}
              >
                <SelectTrigger
                  id={ids.priorTo}
                  className="w-full"
                  aria-describedby={describedBy(ids.priorTo, "priorTo")}
                  aria-invalid={errors.priorTo ? true : undefined}
                >
                  <SelectValue>{priorToLabel(priorTo)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRIOR_TO.map((value) => (
                    <SelectItem key={value} value={value}>
                      {priorToLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <label
              htmlFor={ids.borrowerFacing}
              className="flex items-start gap-3 rounded-lg bg-muted p-3"
            >
              <input
                id={ids.borrowerFacing}
                type="checkbox"
                name="borrowerFacing"
                checked={borrowerFacing}
                onChange={(event) => setBorrowerFacing(event.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-body font-medium text-foreground">
                  Show this to the borrower
                </span>
                <span className="text-caption text-muted-foreground">
                  Turn it off for something you chase internally, like an
                  appraisal.
                </span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <SubmitButton pendingLabel={editing ? "Saving…" : "Adding…"}>
              {editing ? "Save condition" : "Add condition"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The "Add condition" button and the dialog it opens. */
export function AddConditionButton({ loanId }: { loanId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Add condition
      </Button>
      {open ? (
        <ConditionForm loanId={loanId} open onOpenChange={setOpen} />
      ) : null}
    </>
  );
}
