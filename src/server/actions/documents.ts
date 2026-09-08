"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireActor } from "../actor";
import { can, closedLoanReason } from "../authz";
import { insertDocument, receiveCondition } from "../documents";
import {
  CAP_REACHED,
  countUploadsToday,
  fileRejection,
  uploadCapReached,
} from "../limits";
import { getCondition } from "../queries/conditions";
import { getLoanForAction } from "../queries/loans";
import { isInLoanPrefix, safeFileName, statBlob } from "../storage";
import { RegisterDocumentSchema } from "./schemas";

/**
 * Registering an upload that the browser has already written to Blob.
 *
 * The upload route authorized the *token*; this authorizes the *row*, and re-checks
 * everything rather than trusting that it did — a client can call this action directly
 * with any pathname it likes, and `onUploadCompleted` is not used (it never fires on
 * localhost), so this is the only thing standing between a stray blob and a document
 * that appears on a loan.
 *
 * Size and type come from the store, never from the caller (PLAN.md §5).
 */

export type RegisterDocumentState =
  | { ok: true; documentId: string; fileName: string }
  | { ok: false; error: string }
  | null;

/** Staff upload: a session, and the matrix row for this loan. */
export async function registerDocument(
  input: unknown,
): Promise<RegisterDocumentState> {
  const parsed = RegisterDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That upload was not understood." };
  }
  const data = parsed.data;

  const actor = await requireActor();
  const loan = await getLoanForAction(actor, data.loanId);
  if (!loan) return { ok: false, error: "That loan no longer exists." };

  const closed = closedLoanReason(loan, "It takes no more documents.");
  if (closed) return { ok: false, error: closed };
  if (!can(actor, "document.upload", loan)) {
    return {
      ok: false,
      error: "Only this loan's officer or a processor can add documents.",
    };
  }

  // The pathname arrived from the browser. The upload token was pinned to this prefix,
  // but a direct call to this action never saw that token.
  if (!isInLoanPrefix(data.blobPathname, loan.id)) {
    return { ok: false, error: "That file does not belong to this loan." };
  }

  const condition = data.conditionId
    ? await getCondition(actor, loan.id, data.conditionId)
    : null;
  if (data.conditionId && !condition) {
    return { ok: false, error: "That condition is no longer on this loan." };
  }

  const blob = await statBlob(data.blobPathname);
  if (!blob)
    return { ok: false, error: "That upload did not arrive. Try again." };
  const rejection = fileRejection(blob.contentType, blob.size);
  if (rejection) return { ok: false, error: rejection };

  if (uploadCapReached(await countUploadsToday(loan.id))) {
    return { ok: false, error: CAP_REACHED };
  }

  const fileName = safeFileName(data.fileName);
  const documentId = await db().transaction(async (tx) => {
    const id = await insertDocument(tx, {
      loanId: loan.id,
      conditionId: condition?.id ?? null,
      blobPathname: data.blobPathname,
      fileName,
      contentType: blob.contentType,
      sizeBytes: blob.size,
      uploadedVia: "staff",
      uploadedBy: actor.userId,
      activity: {
        actor,
        loanId: loan.id,
        action: "document.uploaded",
        detail: {
          fileName,
          via: "staff",
          conditionId: condition?.id ?? null,
          conditionTitle: condition?.title ?? null,
        },
      },
    });
    if (condition) await receiveCondition(tx, condition.id, condition.status);
    return id;
  });

  revalidatePath(`/loans/${loan.id}`, "layout");
  revalidatePath("/queue");
  return { ok: true, documentId, fileName };
}
