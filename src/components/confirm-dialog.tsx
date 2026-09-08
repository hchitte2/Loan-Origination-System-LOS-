"use client";

import type { ReactNode } from "react";
import { SubmitButton } from "./submit-button";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

/**
 * The 420 px confirm (design frame 03-loan-detail-confirm): a question as the title, one
 * sentence saying what will happen and who sees it, then Cancel left and the action right.
 * Never `window.confirm`.
 *
 * The design asks for `alertdialog` on a confirm, which the Dialog popup takes directly;
 * `DialogDescription` supplies the description it must be labelled by.
 *
 * Confirming submits a real form to a Server Action, so the button is never the control:
 * the action re-checks the actor. `fields` carries the hidden inputs the action needs, and
 * `children` is for the rare confirm that must also ask something — the withdraw reason.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  pendingLabel,
  tone = "destructive",
  action,
  fields,
  error,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** Says what keeping the current state means: "Keep open", "Keep in pipeline". */
  cancelLabel: string;
  /** Says what happens: "Clear condition", "Withdraw loan". */
  confirmLabel: string;
  pendingLabel: string;
  tone?: "destructive" | "primary";
  action: (formData: FormData) => void;
  fields?: Record<string, string>;
  error?: string;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        role="alertdialog"
        showCloseButton={false}
        className="sm:max-w-dialog-confirm"
      >
        <form action={action} className="flex flex-col gap-4">
          {Object.entries(fields ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          {error ? (
            <p role="alert" className="text-caption text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {cancelLabel}
            </DialogClose>
            <SubmitButton
              variant={tone === "destructive" ? "destructive-solid" : "default"}
              pendingLabel={pendingLabel}
            >
              {confirmLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
