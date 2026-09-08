import { and, eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { conditions, documents } from "@/db/schema";
import { type ConditionStatus, statusAfterUpload } from "@/lib/conditions";
import type { UploadedVia } from "@/lib/doc-types";
import { type ActivityInput, logActivity } from "./activity";
import { safeFileName } from "./storage";

/**
 * The document service: the writes that `actions/documents.ts` (staff) and
 * `actions/public.ts` (the borrower's link) both perform, once.
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
