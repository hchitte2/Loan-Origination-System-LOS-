"use client";

import { Download, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ReviewPill } from "@/components/review-pill";
import { buttonVariants } from "@/components/ui/button";
import { UploadZone } from "@/components/upload-zone";
import { canClear } from "@/lib/conditions";
import { formatFileSize, formatRelative } from "@/lib/format";
import { uploadPrefix } from "@/lib/uploads";
import { registerDocument } from "@/server/actions/documents";
import type { ConditionRow } from "@/server/queries/conditions";
import type { LoanDocument } from "@/server/queries/documents";
import {
  DeleteDocumentButton,
  DocumentReview,
  RejectForm,
} from "./document-review";
import {
  ClearConditionButton,
  ClearConditionDialog,
  WaiveConditionButton,
} from "./resolve-buttons";

/**
 * The expanded panel under a condition (design frame 03-loan-detail): what has been sent
 * for it, what a reviewer can do about each file, and a way to add one.
 *
 * Indented and on `muted`, so it reads as belonging to the row above it rather than as
 * another row.
 */
export function ConditionPanel({
  id,
  loanId,
  borrowerFirstName,
  condition,
  documents,
  permissions,
  viewerUserId,
  now,
}: {
  id: string;
  loanId: string;
  borrowerFirstName: string;
  condition: ConditionRow;
  documents: LoanDocument[];
  permissions: {
    manage: boolean;
    resolve: boolean;
    review: boolean;
    upload: boolean;
    delete: boolean;
  };
  /** The effective user, whose own uploads may be taken back. */
  viewerUserId: string;
  now: Date;
}) {
  const router = useRouter();
  // Removing a document destroys the button that was focused, so focus would land on the
  // body at the top of the page. The panel takes it instead, and the next Tab resumes
  // where the person was (`.claude/rules/ui.md`: move focus to the updated element).
  const panelRef = useRef<HTMLDivElement>(null);
  // After accepting the last outstanding file, the design asks whether the condition
  // itself is done. It is a separate decision, so it is a separate prompt.
  const [clearPrompt, setClearPrompt] = useState<string | null>(null);
  // Which document's reason field is open. One at a time: the form is about one file.
  const [rejecting, setRejecting] = useState<string | null>(null);

  const accepted = documents.some((d) => d.reviewStatus === "accepted");
  const settled =
    condition.status === "cleared" || condition.status === "waived";
  const mayClear = permissions.resolve && canClear(condition.status, accepted);
  const mayWaive = permissions.resolve && !settled;

  return (
    <div
      id={id}
      ref={panelRef}
      tabIndex={-1}
      className="bg-muted px-4 py-3 pl-12 outline-none"
    >
      {condition.instructions ? (
        <p className="mb-3 text-body text-muted-foreground">
          {condition.instructions}
        </p>
      ) : null}

      {documents.length === 0 ? (
        <p className="text-body text-muted-foreground">
          Nothing sent for this yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((document) => (
            <li
              key={document.id}
              className="rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {document.fileName}
                    </span>
                    <span className="block text-caption text-muted-foreground">
                      {document.uploadedVia === "public_link"
                        ? `uploaded via ${borrowerFirstName}'s link`
                        : `uploaded by ${document.uploadedByName ?? "a colleague"}`}{" "}
                      · {formatRelative(document.createdAt, now)} ·{" "}
                      {formatFileSize(document.sizeBytes)}
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <ReviewPill status={document.reviewStatus} />
                  {/* A real link, so it opens in a tab, can be middle-clicked, and
                      announces as a link. The route authorizes before a byte is sent. */}
                  <a
                    href={`/api/files/${document.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    <Download aria-hidden="true" />
                    Download
                    <span className="sr-only"> {document.fileName}</span>
                  </a>
                  {permissions.review ? (
                    <DocumentReview
                      loanId={loanId}
                      document={document}
                      rejecting={rejecting === document.id}
                      onRejectingChange={(next) =>
                        setRejecting(next ? document.id : null)
                      }
                      onAccepted={() => {
                        // Only ask about the condition while it is still open: an
                        // already cleared item has nothing to prompt about.
                        if (!settled) setClearPrompt(document.fileName);
                      }}
                    />
                  ) : null}
                  {/* Last in the group: the one thing here that cannot be undone, after
                      the reversible decisions rather than between them. */}
                  {permissions.delete &&
                  document.uploadedVia !== "public_link" &&
                  document.uploadedById === viewerUserId &&
                  document.reviewStatus === "pending" ? (
                    <DeleteDocumentButton
                      loanId={loanId}
                      document={document}
                      condition={condition}
                      onlyDocument={documents.length === 1}
                      onRemoved={() => panelRef.current?.focus()}
                    />
                  ) : null}
                </span>
              </div>

              {document.reviewStatus === "rejected" && document.reviewReason ? (
                <p className="mt-2 text-caption text-destructive">
                  Rejected · {document.reviewReason}
                </p>
              ) : null}

              {rejecting === document.id ? (
                <RejectForm
                  loanId={loanId}
                  document={document}
                  borrowerFirstName={borrowerFirstName}
                  onClose={() => setRejecting(null)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {(mayClear || mayWaive || permissions.upload) && !settled ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {mayClear ? (
              <ClearConditionButton
                loanId={loanId}
                condition={condition}
                borrowerFirstName={borrowerFirstName}
              />
            ) : null}
            {mayWaive ? (
              <WaiveConditionButton
                loanId={loanId}
                condition={condition}
                borrowerFirstName={borrowerFirstName}
              />
            ) : null}
          </div>
          {permissions.upload ? (
            <div className="max-w-sm">
              <UploadZone
                pathnamePrefix={uploadPrefix(loanId)}
                clientPayload={{ loanId }}
                label={`Upload a file for ${condition.title}`}
                register={async (file) => {
                  const result = await registerDocument({
                    loanId,
                    conditionId: condition.id,
                    ...file,
                  });
                  if (result?.ok) {
                    toast.success(
                      `${result.fileName} added to ${condition.title}.`,
                    );
                    // The upload is a direct Server Action call, not a form submission,
                    // so nothing re-renders this route on its own. Without this the new
                    // document is in the database and invisible on screen.
                    router.refresh();
                    return null;
                  }
                  return result?.error ?? "That upload did not go through.";
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {clearPrompt ? (
        <ClearConditionDialog
          loanId={loanId}
          condition={condition}
          borrowerFirstName={borrowerFirstName}
          description={`${condition.title} has one accepted document. ${borrowerFirstName} will see it as Accepted.`}
          onClose={() => setClearPrompt(null)}
        />
      ) : null}
    </div>
  );
}
