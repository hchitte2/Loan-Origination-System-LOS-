import { and, asc, count, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { documents, loans, user } from "@/db/schema";
import type { DocType, ReviewStatus, UploadedVia } from "@/lib/doc-types";
import type { Actor } from "../actor";
import { assertCan, loanScope } from "../authz";

/**
 * Document reads. `document.download` is `any` for all three staff roles (PLAN.md §2),
 * so these authorize and then return every row for the loan asked for — including a
 * terminal loan's, because a closed file stays readable (§6 invariant 8).
 *
 * Loan ids must be ones the server derived (`getLoanForAction`), never an id straight
 * from a client. `getDocumentForDownload` is the exception: it takes an id from the URL
 * and resolves the loan itself, so the authorization happens here.
 */

export type LoanDocument = {
  id: string;
  conditionId: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  docType: DocType | null;
  reviewStatus: ReviewStatus;
  reviewReason: string | null;
  uploadedVia: UploadedVia;
  /** The staff member who uploaded it; null when the borrower did, through the link. */
  uploadedById: string | null;
  /** Their name, so a row can say "uploaded by Sam Okafor" instead of "by staff". */
  uploadedByName: string | null;
  createdAt: Date;
};

/** Every document on one loan, oldest first, so a condition's history reads in order. */
export async function listLoanDocuments(
  actor: Actor,
  loanId: string,
): Promise<LoanDocument[]> {
  assertCan(actor, "document.download");
  return await db()
    .select({
      id: documents.id,
      conditionId: documents.conditionId,
      fileName: documents.fileName,
      contentType: documents.contentType,
      sizeBytes: documents.sizeBytes,
      docType: documents.docType,
      reviewStatus: documents.reviewStatus,
      reviewReason: documents.reviewReason,
      uploadedVia: documents.uploadedVia,
      uploadedById: documents.uploadedBy,
      uploadedByName: user.name,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .leftJoin(user, eq(user.id, documents.uploadedBy))
    .where(eq(documents.loanId, loanId))
    .orderBy(asc(documents.createdAt));
}

/** How many documents hang on one condition. Invariant 9 asks before a delete. */
export async function countConditionDocuments(
  actor: Actor,
  conditionId: string,
): Promise<number> {
  assertCan(actor, "condition.read");
  const [row] = await db()
    .select({ total: count() })
    .from(documents)
    .where(eq(documents.conditionId, conditionId));
  return row?.total ?? 0;
}

/**
 * Does this condition still have an accepted document, ignoring one? Clearing asks with
 * `exceptId` unset; rejecting asks whether anything else survives the rejection.
 */
export async function hasAcceptedDocument(
  actor: Actor,
  conditionId: string,
  exceptId?: string,
): Promise<boolean> {
  assertCan(actor, "condition.read");
  const [row] = await db()
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.conditionId, conditionId),
        eq(documents.reviewStatus, "accepted"),
        exceptId ? ne(documents.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return row !== undefined;
}

export type DownloadableDocument = {
  id: string;
  loanId: string;
  fileName: string;
  contentType: string;
  blobPathname: string;
};

/**
 * One document, by the id in the download URL, or null.
 *
 * The id arrives from a client, so the loan is joined and put through `loanScope` here
 * rather than trusted. Reads are unfiltered for all three staff roles today, so the
 * scope is a no-op — it is applied anyway, so that narrowing it later narrows downloads
 * with it instead of leaving this the one way around. Null covers both "no such
 * document" and "not visible", so a caller cannot probe for ids.
 */
export async function getDocumentForDownload(
  actor: Actor,
  documentId: string,
): Promise<DownloadableDocument | null> {
  assertCan(actor, "document.download");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      documentId,
    )
  ) {
    return null;
  }
  const [row] = await db()
    .select({
      id: documents.id,
      loanId: documents.loanId,
      fileName: documents.fileName,
      contentType: documents.contentType,
      blobPathname: documents.blobPathname,
    })
    .from(documents)
    .innerJoin(loans, eq(loans.id, documents.loanId))
    .where(and(eq(documents.id, documentId), loanScope(actor, "read")))
    .limit(1);
  return row ?? null;
}

/** The slice of a document the review actions need, scoped to the loan they name. */
export type ReviewableDocument = {
  id: string;
  conditionId: string | null;
  fileName: string;
  reviewStatus: ReviewStatus;
};

/**
 * One document on one loan, or null. The loan id must be one the server derived; the
 * document id came from a client, so scoping it to that loan is what stops an id from
 * another file being reviewed through a loan the actor does have.
 */
export async function getDocumentOnLoan(
  actor: Actor,
  loanId: string,
  documentId: string,
): Promise<ReviewableDocument | null> {
  assertCan(actor, "document.download");
  const [row] = await db()
    .select({
      id: documents.id,
      conditionId: documents.conditionId,
      fileName: documents.fileName,
      reviewStatus: documents.reviewStatus,
    })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.loanId, loanId)))
    .limit(1);
  return row ?? null;
}
