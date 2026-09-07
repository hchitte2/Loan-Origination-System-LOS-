/**
 * Document catalog: the document types a mortgage file collects, plus review and
 * upload-channel vocabularies (PLAN.md §6). `src/db/schema.ts` builds the Postgres
 * enums from these arrays.
 */

export const DOC_TYPES = [
  "photo_id",
  "pay_stub",
  "w2",
  "tax_return",
  "bank_statement",
  "investment_statement",
  "gift_letter",
  "earnest_money",
  "purchase_contract",
  "appraisal",
  "insurance_binder",
  "title_commitment",
  "mortgage_statement",
  "letter_of_explanation",
  "other",
] as const;

export type DocType = (typeof DOC_TYPES)[number];

const DOC_TYPE_LABELS = {
  photo_id: "Photo ID",
  pay_stub: "Pay stub",
  w2: "W-2",
  tax_return: "Tax return",
  bank_statement: "Bank statement",
  investment_statement: "Investment statement",
  gift_letter: "Gift letter",
  earnest_money: "Earnest money receipt",
  purchase_contract: "Purchase contract",
  appraisal: "Appraisal",
  insurance_binder: "Insurance binder",
  title_commitment: "Title commitment",
  mortgage_statement: "Mortgage statement",
  letter_of_explanation: "Letter of explanation",
  other: "Other",
} as const satisfies Record<DocType, string>;

export function docTypeLabel(docType: DocType): string {
  return DOC_TYPE_LABELS[docType];
}

export const REVIEW_STATUSES = ["pending", "accepted", "rejected"] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const REVIEW_STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
} as const satisfies Record<ReviewStatus, string>;

/** Staff label only; the borrower page never shows a review status word. */
export function reviewStatusLabel(status: ReviewStatus): string {
  return REVIEW_STATUS_LABELS[status];
}

export const UPLOADED_VIA = ["staff", "public_link"] as const;

export type UploadedVia = (typeof UPLOADED_VIA)[number];
