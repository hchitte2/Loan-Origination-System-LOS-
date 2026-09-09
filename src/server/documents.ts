import { and, eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { conditions, documents } from "@/db/schema";
import {
  type ConditionStatus,
  statusAfterDeletion,
  statusAfterRejection,
  statusAfterUpload,
} from "@/lib/conditions";
import type { ReviewStatus, UploadedVia } from "@/lib/doc-types";
import { safeFileName } from "@/lib/uploads";
import { type ActivityInput, logActivity } from "./activity";

/**
 * The document service: the review pipeline's writes — a document arriving, being
 * accepted or rejected, and the condition it answers being cleared or waived.
 *
 * It lives outside both because a `"use server"` module's exports are callable over the
 * network — a shared helper exported from one would be a Server Action nobody
 * authorized. Nothing here decides *whether*: both callers have already resolved the
 * loan and the actor and run their own checks, and pass the results in.
 *
 * Every function takes the transaction, so the row and its activity land together
 * (PLAN.md §6 invariant 4).
 */

export type RegisterUpload = {
  loanId: string;
  conditionId: string | null;
  blobPathname: string;
  fileName: string;
  /** From `statBlob`, never from the caller. */
  contentType: string;
  sizeBytes: number;
  uploadedVia: UploadedVia;
  /** The staff member who uploaded; null for the public link. */
  uploadedBy: string | null;
  activity: ActivityInput;
};

/** Insert the document row and its one activity row. Returns the new id. */
export async function insertDocument(
  tx: Tx,
  input: RegisterUpload,
): Promise<string> {
  const [created] = await tx
    .insert(documents)
    .values({
      loanId: input.loanId,
      conditionId: input.conditionId,
      uploadedBy: input.uploadedBy,
      uploadedVia: input.uploadedVia,
      fileName: safeFileName(input.fileName),
      blobPathname: input.blobPathname,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    })
    .returning({ id: documents.id });
  if (!created) throw new Error("The document insert returned no row.");
  await logActivity(tx, input.activity);
  return created.id;
}

/**
 * Move a condition to `received` if this upload is its first answer (PLAN.md §6
 * invariant 3), and clear the rejection reason with it — the borrower has responded, so
 * "Needs another: pages are cut off" must stop being shown.
 *
 * The compare-and-set on the status it was read at means a reviewer clearing the same
 * condition in another tab is not quietly undone by an upload that raced them.
 */
export async function receiveCondition(
  tx: Tx,
  conditionId: string,
  current: ConditionStatus,
): Promise<void> {
  const next = statusAfterUpload(current);
  if (!next) return;
  await tx
    .update(conditions)
    .set({ status: next, lastRejectionReason: null })
    .where(and(eq(conditions.id, conditionId), eq(conditions.status, current)));
}

/**
 * Accept a document: mark it reviewed, and note who and when. The condition does not
 * move — accepting is a statement about the file, and clearing is the separate decision
 * about the requirement, which is why the design prompts for it afterwards.
 */
export async function acceptDocument(
  tx: Tx,
  input: {
    documentId: string;
    from: ReviewStatus;
    reviewerId: string;
    activity: ActivityInput;
  },
): Promise<boolean> {
  const changed = await tx
    .update(documents)
    .set({
      reviewStatus: "accepted",
      reviewReason: null,
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
    })
    // Compare-and-set on the status it was read at, so two reviewers deciding at once
    // write one activity row for one decision, not two (PLAN.md §6 invariant 4).
    .where(
      and(
        eq(documents.id, input.documentId),
        eq(documents.reviewStatus, input.from),
      ),
    )
    .returning({ id: documents.id });
  if (changed.length === 0) return false;
  await logActivity(tx, input.activity);
  return true;
}

/**
 * Reject a document with the reason the borrower will read, and reopen the condition if
 * nothing accepted is left standing on it (PLAN.md §6 invariant 3). The reason is
 * written to the condition too, which is what turns "Needed" into
 * "Needs another: pages are cut off" on the public page.
 */
export async function rejectDocument(
  tx: Tx,
  input: {
    documentId: string;
    from: ReviewStatus;
    reviewerId: string;
    reason: string;
    condition: { id: string; status: ConditionStatus } | null;
    hasOtherAcceptedDocument: boolean;
    activity: ActivityInput;
  },
): Promise<boolean> {
  const changed = await tx
    .update(documents)
    .set({
      reviewStatus: "rejected",
      reviewReason: input.reason,
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
    })
    .where(
      and(
        eq(documents.id, input.documentId),
        eq(documents.reviewStatus, input.from),
      ),
    )
    .returning({ id: documents.id });
  if (changed.length === 0) return false;

  if (input.condition) {
    const next = statusAfterRejection(
      input.condition.status,
      input.hasOtherAcceptedDocument,
    );
    if (next) {
      await tx
        .update(conditions)
        .set({ status: next, lastRejectionReason: input.reason })
        .where(
          and(
            eq(conditions.id, input.condition.id),
            eq(conditions.status, input.condition.status),
          ),
        );
    }
  }
  await logActivity(tx, input.activity);
  return true;
}

/**
 * Delete a document and reopen the condition if it was the only thing on it.
 *
 * The row goes rather than being flagged, which is the one place this codebase removes
 * history — so the `document.deleted` activity row is what survives, and `activity` is
 * append-only, so it cannot be taken back afterwards.
 *
 * The compare-and-set on `review_status` is the important part: a processor accepting or
 * rejecting in another tab between the caller's read and this write must win, because
 * once a document has been reviewed it is a record of a decision and no longer the
 * uploader's to withdraw. Returns false when that happened, and the caller says so.
 */
export async function deleteDocument(
  tx: Tx,
  input: {
    documentId: string;
    from: ReviewStatus;
    condition: { id: string; status: ConditionStatus } | null;
    hasOtherDocument: boolean;
    activity: ActivityInput;
  },
): Promise<boolean> {
  const removed = await tx
    .delete(documents)
    .where(
      and(
        eq(documents.id, input.documentId),
        eq(documents.reviewStatus, input.from),
      ),
    )
    .returning({ id: documents.id });
  if (removed.length === 0) return false;

  if (input.condition) {
    const next = statusAfterDeletion(
      input.condition.status,
      input.hasOtherDocument,
    );
    if (next) {
      await tx
        .update(conditions)
        .set({ status: next })
        .where(
          and(
            eq(conditions.id, input.condition.id),
            eq(conditions.status, input.condition.status),
          ),
        );
    }
  }
  await logActivity(tx, input.activity);
  return true;
}

/**
 * Resolve a condition — cleared because a document was accepted, or waived because none
 * will ever come. `cleared_by` and `cleared_at` record who settled it either way.
 *
 * Both drop `last_rejection_reason`: it is what turns "Needed" into
 * "Needs another: …" on the borrower's page, and a settled item must stop saying that.
 * A waiver's reason lives only in its activity row (PLAN.md §6, `condition.waived
 * {reason}`) — the borrower sees "No longer needed" and is not told why, because the
 * reason is a note between staff.
 */
export async function resolveCondition(
  tx: Tx,
  input: {
    conditionId: string;
    from: ConditionStatus;
    to: "cleared" | "waived";
    reviewerId: string;
    activity: ActivityInput;
  },
): Promise<boolean> {
  const changed = await tx
    .update(conditions)
    .set({
      status: input.to,
      clearedBy: input.reviewerId,
      clearedAt: new Date(),
      lastRejectionReason: null,
    })
    // Compare-and-set on the status it was decided from: a borrower uploading against
    // this condition in the same moment must not have their answer silently overwritten
    // by a decision made before it arrived.
    .where(
      and(
        eq(conditions.id, input.conditionId),
        eq(conditions.status, input.from),
      ),
    )
    .returning({ id: conditions.id });
  if (changed.length === 0) return false;
  await logActivity(tx, input.activity);
  return true;
}
