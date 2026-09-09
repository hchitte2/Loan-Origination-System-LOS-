"use client";

import { Check, X } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptDocumentAction,
  type ReviewDocumentState,
  rejectDocumentAction,
} from "@/server/actions/documents";
import type { LoanDocument } from "@/server/queries/documents";

/**
 * Accept and reject, on a document row (design frame 03-loan-detail).
 *
 * Rejecting opens inline rather than in a dialog, because the reason is the point: the
 * frame shows the field expanded under the row with the label saying, plainly, that the
 * borrower reads what is typed there.
 *
 * Both are real forms posting to Server Actions; the actions re-check the actor and the
 * loan, so hiding these buttons is presentation, not protection.
 */
export function DocumentReview({
  loanId,
  document,
  borrowerFirstName,
  onAccepted,
}: {
  loanId: string;
  document: LoanDocument;
  borrowerFirstName: string;
  onAccepted: () => void;
}) {
  const reasonId = useId();
  const [rejecting, setRejecting] = useState(false);

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

  const [rejectState, rejectAction] = useActionState<
    ReviewDocumentState,
    FormData
  >(async (previous, formData) => {
    const result = await rejectDocumentAction(previous, formData);
    if (result?.ok) {
      setRejecting(false);
      toast.success(
        `${result.fileName} rejected. ${borrowerFirstName} can send another.`,
      );
      return null;
    }
    return result;
  }, null);

  const error =
    (acceptState && !acceptState.ok ? acceptState.error : undefined) ??
    (rejectState && !rejectState.ok && !rejecting
      ? rejectState.error
      : undefined);

  return (
    <div className="mt-2 border-t border-border pt-2">
      {rejecting ? (
        <form action={rejectAction} className="flex flex-col gap-2">
          <input type="hidden" name="loanId" value={loanId} />
          <input type="hidden" name="documentId" value={document.id} />
          <label htmlFor={reasonId} className="flex flex-col gap-1.5">
            <span className="text-control text-foreground">
              Reject · reason required ·{" "}
              <span className="font-normal text-muted-foreground">
                {borrowerFirstName} sees this reason in plain language
              </span>
            </span>
            <Textarea
              id={reasonId}
              name="reason"
              required
              minLength={3}
              maxLength={300}
              rows={2}
              // The reviewer pressed Reject; the reason is the only thing left to do.
              autoFocus
              placeholder="Second page is missing."
            />
          </label>
          {rejectState && !rejectState.ok ? (
            <p role="alert" className="text-caption text-destructive">
              {rejectState.error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejecting(false)}
            >
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
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {document.reviewStatus === "accepted" ? null : (
            <form action={acceptAction}>
              <input type="hidden" name="loanId" value={loanId} />
              <input type="hidden" name="documentId" value={document.id} />
              <SubmitButton
                variant="ghost"
                size="sm"
                className="text-success"
                pendingLabel="Accepting…"
              >
                <Check aria-hidden="true" />
                Accept
              </SubmitButton>
            </form>
          )}
          {document.reviewStatus === "rejected" ? null : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setRejecting(true)}
            >
              <X aria-hidden="true" />
              Reject
            </Button>
          )}
          {error ? (
            <p role="alert" className="text-caption text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
