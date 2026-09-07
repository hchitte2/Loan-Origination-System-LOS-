/**
 * Loan fact vocabularies: purpose, program and referral source, with their labels
 * (PLAN.md §6). `src/db/schema.ts` builds the Postgres enums from these arrays.
 */

export const PURPOSES = ["purchase", "refinance"] as const;

export type Purpose = (typeof PURPOSES)[number];

const PURPOSE_LABELS = {
  purchase: "Purchase",
  refinance: "Refinance",
} as const satisfies Record<Purpose, string>;

export function purposeLabel(purpose: Purpose): string {
  return PURPOSE_LABELS[purpose];
}

export const LOAN_TYPES = ["conventional", "fha", "va", "other"] as const;

export type LoanType = (typeof LOAN_TYPES)[number];

const LOAN_TYPE_LABELS = {
  conventional: "Conventional",
  fha: "FHA",
  va: "VA",
  other: "Other",
} as const satisfies Record<LoanType, string>;

/** Program label as staff say it: "Conventional", "FHA", "VA". */
export function loanTypeLabel(loanType: LoanType): string {
  return LOAN_TYPE_LABELS[loanType];
}

export const REFERRAL_SOURCES = [
  "realtor",
  "past_client",
  "online",
  "other",
] as const;

export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

const REFERRAL_SOURCE_LABELS = {
  realtor: "Realtor",
  past_client: "Past client",
  online: "Online",
  other: "Other",
} as const satisfies Record<ReferralSource, string>;

export function referralSourceLabel(source: ReferralSource): string {
  return REFERRAL_SOURCE_LABELS[source];
}
