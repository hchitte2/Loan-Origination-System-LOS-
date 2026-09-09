"use client";

import { Check, CircleAlert, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptDocumentAction,
  type DeleteDocumentState,
  deleteDocumentAction,
  type ReviewDocumentState,
  rejectDocumentAction,
} from "@/server/actions/documents";
import type { LoanDocument } from "@/server/queries/documents";

/**
 * Accept and Reject, on the document row itself (design frame 03-loan-detail): both sit
 * in the same right-hand group as the review pill and Download, so one file reads as one
 * line. Pressing Reject opens `RejectForm` below the row rather than replacing them.
 *
 * Both are real forms posting to Server Actions; the actions re-check the actor and the
 * loan, so hiding these buttons is presentation, not protection.
 */
export function DocumentReview({
  loanId,
  document,
  rejecting,
  onRejectingChange,
  onAccepted,
}: {
  loanId: string;
  document: LoanDocument;
  rejecting: boolean;
  onRejectingChange: (rejecting: boolean) => void;
  onAccepted: () => void;
}) {
  const rejectRef = useRef<HTMLButtonElement>(null);
  const wasRejecting = useRef(false);

  // When the form closes — cancelled or submitted — focus returns to the button that
  // opened it, rather than being dropped on the body.
  useEffect(() => {
    if (wasRejecting.current && !rejecting) rejectRef.current?.focus();
    wasRejecting.current = rejecting;
  }, [rejecting]);

  const [acceptState, acceptAction] = useActionState<
    ReviewDocumentState,
    FormData
  >(async (previous, formData) => {
    const result = await acceptDocumentAction(previous, formData);
    if (result?.ok) {
      toast.success(`${result.fileName} accepted.`);
      onAccepted();
      return null;
    }
    return result;
  }, null);

  return (
    <>
      {document.reviewStatus === "accepted" ? null : (
        <form action={acceptAction} className="contents">
          <input type="hidden" name="loanId" value={loanId} />
          <input type="hidden" name="documentId" value={document.id} />
          <SubmitButton
            variant="outline"
            size="sm"
            className="text-success-on-soft"
            pendingLabel="Accepting…"
          >
            <Check aria-hidden="true" />
            Accept
            <span className="sr-only"> {document.fileName}</span>
          </SubmitButton>
        </form>
      )}
      {document.reviewStatus === "rejected" ? null : (
        <Button
          ref={rejectRef}
          type="button"
          variant="destructive"
          size="sm"
          aria-expanded={rejecting}
          onClick={() => onRejectingChange(!rejecting)}
        >
          <X aria-hidden="true" />
          Reject
          <span className="sr-only"> {document.fileName}</span>
        </Button>
      )}
      {acceptState && !acceptState.ok ? (
        <span role="alert" className="text-caption text-destructive">
          {acceptState.error}
        </span>
      ) : null}
    </>
  );
}

/**
 * The reason field (design frame 03-loan-detail). It opens as its own card below the
 * document, because the reason is the point of a rejection: the label says plainly that
 * the borrower reads what is typed here, and the buttons sit where a form's buttons go.
 */
export function RejectForm({
  loanId,
  document,
  borrowerFirstName,
  onClose,
}: {
  loanId: string;
  document: LoanDocument;
  borrowerFirstName: string;
  onClose: () => void;
}) {
  const reasonId = useId();
  const errorId = useId();

  const [state, formAction] = useActionState<ReviewDocumentState, FormData>(
    async (previous, formData) => {
      const result = await rejectDocumentAction(previous, formData);
      if (result?.ok) {
        toast.success(
          `${result.fileName} rejected. ${borrowerFirstName} can send another.`,
        );
        onClose();
        return null;
      }
      return result;
    },
    null,
  );
  const error = state && !state.ok ? state.error : undefined;

  return (
    <form
      action={formAction}
      className="mt-2 flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
    >
      <input type="hidden" name="loanId" value={loanId} />
      <input type="hidden" name="documentId" value={document.id} />
      <label htmlFor={reasonId} className="text-control text-foreground">
        Reject · reason required ·{" "}
        <span className="font-normal text-muted-foreground">
          {borrowerFirstName} sees this reason in plain language
        </span>
      </label>
      <Textarea
        id={reasonId}
        name="reason"
        required
        minLength={3}
        maxLength={300}
        rows={2}
        // The reviewer pressed Reject; the reason is the only thing left to do.
        autoFocus
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder="Second page is missing."
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-caption text-destructive"
        >
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Keep pending
        </Button>
        <SubmitButton
          variant="destructive-solid"
          size="sm"
          pendingLabel="Rejecting…"
        >
          Reject document
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * "Remove" on your own pending upload (the wrong file, caught before anyone reviewed it).
 *
 * A confirm rather than a bare button: the file goes from the store as well as the list,
 * and unlike everything else on this screen it cannot be undone. The word is "Remove"
 * rather than "Delete" because the sentence in the dialog is what carries the weight, and
 * because the borrower's copy never says "delete" either.
 *
 * Rejecting is the other way a file leaves a condition, and it is the wrong one here: its
 * reason is borrower-facing, so using it on a staff slip tells someone to resend a file
 * they never sent.
 */
export function DeleteDocumentButton({
  loanId,
  document,
}: {
  loanId: string;
  document: LoanDocument;
}) {
  const [confirming, setConfirming] = useState(false);

  const [state, formAction] = useActionState<DeleteDocumentState, FormData>(
    async (previous, formData) => {
      const result = await deleteDocumentAction(previous, formData);
      if (result?.ok) {
        setConfirming(false);
        toast.success(`${result.fileName} removed.`);
        return null;
      }
      return result;
    },
    null,
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden="true" />
        Remove
        <span className="sr-only"> {document.fileName}</span>
      </Button>

      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirming(false);
          }}
          title={`Remove ${document.fileName}?`}
          description="The file is deleted and the item goes back to being requested. This cannot be undone."
          cancelLabel="Keep the file"
          confirmLabel="Remove file"
          pendingLabel="Removing…"
          action={formAction}
          fields={{ loanId, documentId: document.id }}
          error={state && !state.ok ? state.error : undefined}
        />
      ) : null}
    </>
  );
}
