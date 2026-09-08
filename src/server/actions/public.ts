"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { insertDocument, receiveCondition } from "../documents";
import {
  CAP_REACHED,
  countUploadsToday,
  fileRejection,
  uploadCapReached,
} from "../limits";
import { getPublicCondition, resolveUploadToken } from "../queries/public";
import { isInLoanPrefix, safeFileName, statBlob } from "../storage";
import { RegisterPublicDocumentSchema } from "./schemas";

/**
 * The borrower's only mutation (`.claude/rules/public.md`).
 *
 * There is no session, so the token is the whole of the authorization and every check
 * hangs off it: it must exist, not be revoked, and belong to a loan that is still open
 * (PLAN.md §6 invariant 5). The condition must be on that loan and borrower-facing, so
 * an internal item cannot be answered by guessing its id.
 *
 * Everything the browser says is re-derived: the loan from the token rather than from a
 * loan id, the size and type from the store rather than from the request. The upload
 * route made the same decisions before issuing the token, and this repeats them because
 * a client can call this action directly.
 *
 * Failures are warm and vague on purpose. A bad token, a revoked link and a closed loan
 * all read the same, so nobody can tell them apart by trying.
 */

export type RegisterPublicDocumentState =
  | { ok: true; conditionTitle: string; fileName: string }
  | { ok: false; error: string }
  | null;

export async function registerPublicDocument(
  input: unknown,
): Promise<RegisterPublicDocumentState> {
  const parsed = RegisterPublicDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That upload did not go through. Try again." };
  }
  const data = parsed.data;

  const loan = await resolveUploadToken(data.token);
  if (!loan) return { ok: false, error: "This link is no longer active." };

  const condition = await getPublicCondition(loan.id, data.conditionId);
  if (!condition) {
    return { ok: false, error: "That item is no longer being asked for." };
  }

  if (!isInLoanPrefix(data.blobPathname, loan.id)) {
    return { ok: false, error: "That file did not go through. Try again." };
  }

  const blob = await statBlob(data.blobPathname);
  if (!blob) {
    return { ok: false, error: "That file did not go through. Try again." };
  }
  const rejection = fileRejection(blob.contentType, blob.size);
  if (rejection) return { ok: false, error: rejection };

  if (uploadCapReached(await countUploadsToday(loan.id))) {
    return { ok: false, error: CAP_REACHED };
  }

  const fileName = safeFileName(data.fileName);
  await db().transaction(async (tx) => {
    await insertDocument(tx, {
      loanId: loan.id,
      conditionId: condition.id,
      blobPathname: data.blobPathname,
      fileName,
      contentType: blob.contentType,
      sizeBytes: blob.size,
      uploadedVia: "public_link",
      // Nobody signed in, so there is no user to credit — `actor_kind` says how it came.
      uploadedBy: null,
      activity: {
        actorKind: "public_link",
        loanId: loan.id,
        action: "document.uploaded",
        detail: {
          fileName,
          via: "public_link",
          conditionId: condition.id,
          conditionTitle: condition.title,
          // The e-consent tick, recorded with the upload it was given for. The log is
          // append-only, so this is the durable record that it was shown and accepted.
          econsent: data.econsent,
        },
      },
    });
    await receiveCondition(tx, condition.id, condition.status);
  });

  revalidatePath(`/u/${data.token}`);
  // The staff surfaces this upload appears on. The borrower cannot see either.
  revalidatePath(`/loans/${loan.id}`, "layout");
  revalidatePath("/queue");
  return { ok: true, conditionTitle: condition.title, fileName };
}
