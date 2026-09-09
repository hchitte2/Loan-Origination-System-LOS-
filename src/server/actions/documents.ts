"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  fileRejection,
  isInLoanPrefix,
  rejectionSentence,
  safeFileName,
} from "@/lib/uploads";
import { type Actor, requireActor } from "../actor";
import { can, closedLoanReason } from "../authz";
import {
  acceptDocument,
  insertDocument,
  receiveCondition,
  rejectDocument,
} from "../documents";
import { CAP_REACHED, countUploadsToday, uploadCapReached } from "../limits";
import { getCondition } from "../queries/conditions";
import { getDocumentOnLoan, hasAcceptedDocument } from "../queries/documents";
import { getLoanForAction } from "../queries/loans";
import { statBlob } from "../storage";
import {
  AcceptDocumentSchema,
  RegisterDocumentSchema,
  RejectDocumentSchema,
} from "./schemas";

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
  if (rejection) return { ok: false, error: rejectionSentence(rejection) };

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

export type ReviewDocumentState =
  | { ok: true; fileName: string; conditionTitle: string | null }
  | { ok: false; error: string }
  | null;

/** The document was reviewed by someone else between the read and the write. */
class StaleDocumentError extends Error {
  constructor() {
    super("The document was already reviewed.");
    this.name = "StaleDocumentError";
  }
}

/**
 * Run a review transaction, turning a lost compare-and-set into the sentence a reviewer
 * should see rather than a 500. Two people working the same queue is ordinary.
 */
async function applyReview(
  fileName: string,
  write: () => Promise<void>,
): Promise<string | null> {
  try {
    await write();
    return null;
  } catch (error) {
    if (error instanceof StaleDocumentError) {
      return `${fileName} was reviewed a moment ago. Reload and try again.`;
    }
    throw error;
  }
}

/**
 * Everything accept and reject share: load the loan, the document scoped to it, and the
 * condition it answers, then check the reviewer may act. Returns the loaded rows or the
 * sentence to show.
 */
type ReviewContext =
  | { ok: false; error: string }
  | {
      ok: true;
      actor: Actor;
      loan: NonNullable<Awaited<ReturnType<typeof getLoanForAction>>>;
      document: NonNullable<Awaited<ReturnType<typeof getDocumentOnLoan>>>;
      condition: Awaited<ReturnType<typeof getCondition>>;
    };

async function loadForReview(
  loanId: string,
  documentId: string,
): Promise<ReviewContext> {
  const actor = await requireActor();
  const loan = await getLoanForAction(actor, loanId);
  if (!loan) return { ok: false, error: "That loan no longer exists." };

  const closed = closedLoanReason(
    loan,
    "Its documents are no longer reviewed.",
  );
  if (closed) return { ok: false, error: closed };
  if (!can(actor, "document.review", loan)) {
    return { ok: false, error: "Only a processor reviews documents." };
  }

  const document = await getDocumentOnLoan(actor, loan.id, documentId);
  if (!document) {
    return { ok: false, error: "That document is no longer on this loan." };
  }
  const condition = document.conditionId
    ? await getCondition(actor, loan.id, document.conditionId)
    : null;
  return { ok: true, actor, loan, document, condition };
}

/**
 * Accept a document. The condition stays where it is: accepting says the file is good,
 * clearing says the requirement is met, and the design asks for the second separately
 * ("Clear this condition?") so a reviewer is never surprised into closing an item.
 */
export async function acceptDocumentAction(
  _previous: ReviewDocumentState,
  formData: FormData,
): Promise<ReviewDocumentState> {
  const parsed = AcceptDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: "That review was not understood." };
  }
  const loaded = await loadForReview(
    parsed.data.loanId,
    parsed.data.documentId,
  );
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { actor, loan, document, condition } = loaded;

  if (document.reviewStatus === "accepted") {
    return { ok: false, error: `${document.fileName} is already accepted.` };
  }

  const stale = await applyReview(document.fileName, async () => {
    await db().transaction(async (tx) => {
      const applied = await acceptDocument(tx, {
        documentId: document.id,
        from: document.reviewStatus,
        reviewerId: actor.userId,
        activity: {
          actor,
          loanId: loan.id,
          action: "document.accepted",
          detail: {
            documentId: document.id,
            fileName: document.fileName,
            conditionId: condition?.id ?? null,
            conditionTitle: condition?.title ?? null,
          },
        },
      });
      if (!applied) throw new StaleDocumentError();
    });
  });
  if (stale) return { ok: false, error: stale };

  revalidatePath(`/loans/${loan.id}`, "layout");
  revalidatePath("/queue");
  return {
    ok: true,
    fileName: document.fileName,
    conditionTitle: condition?.title ?? null,
  };
}

/**
 * Reject a document with a reason. If nothing accepted is left on the condition it
 * answers, the condition reopens carrying that reason, which is what the borrower reads
 * as "Needs another: …" (PLAN.md §6 invariant 3).
 */
export async function rejectDocumentAction(
  _previous: ReviewDocumentState,
  formData: FormData,
): Promise<ReviewDocumentState> {
  const parsed = RejectDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "That review was not understood.",
    };
  }
  const { loanId, documentId, reason } = parsed.data;
  const loaded = await loadForReview(loanId, documentId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { actor, loan, document, condition } = loaded;

  if (document.reviewStatus === "rejected") {
    return { ok: false, error: `${document.fileName} is already rejected.` };
  }

  // Whether anything else on this condition is still accepted, ignoring the document
  // being rejected — a condition holding another accepted file stays answered.
  const otherAccepted = condition
    ? await hasAcceptedDocument(actor, condition.id, document.id)
    : false;

  const stale = await applyReview(document.fileName, async () => {
    await db().transaction(async (tx) => {
      const applied = await rejectDocument(tx, {
        documentId: document.id,
        from: document.reviewStatus,
        reviewerId: actor.userId,
        reason,
        condition: condition
          ? { id: condition.id, status: condition.status }
          : null,
        hasOtherAcceptedDocument: otherAccepted,
        activity: {
          actor,
          loanId: loan.id,
          action: "document.rejected",
          detail: {
            documentId: document.id,
            fileName: document.fileName,
            reason,
            conditionId: condition?.id ?? null,
            conditionTitle: condition?.title ?? null,
          },
        },
      });
      if (!applied) throw new StaleDocumentError();
    });
  });
  if (stale) return { ok: false, error: stale };

  revalidatePath(`/loans/${loan.id}`, "layout");
  revalidatePath("/queue");
  return {
    ok: true,
    fileName: document.fileName,
    conditionTitle: condition?.title ?? null,
  };
}
