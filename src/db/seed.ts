import { createHash } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { notInArray, sql } from "drizzle-orm";
import type { ActivityAction } from "@/lib/activity";
import type { ConditionStatus, PriorTo } from "@/lib/conditions";
import type { LoanType, Purpose, ReferralSource } from "@/lib/loan-facts";
import { defaultNeedsList } from "@/lib/needs-list";
import {
  ACTIVE_STAGES,
  type ActiveStage,
  type ClosedReason,
  isActiveStage,
  type Stage,
  stageIndex,
} from "@/lib/stages";
import { DEMO_USERS, demoUser, USER_ID, type UserKey } from "./demo-users";
import type { Db } from "./index";

import {
  account,
  activity,
  conditions,
  documents,
  loans,
  type NewActivity,
  user,
} from "./schema";

/**
 * The demo fixture (PLAN.md §6 "Seed fixture"), transcribed from the approved design's
 * sample data. Deterministic: no random numbers, every date relative to `now`. The same
 * function is the reset routine: it truncates the four application tables in one
 * statement (row triggers do not fire on TRUNCATE, which is the one sanctioned way past
 * the append-only audit log), restores the six staff accounts, removes any user a visitor
 * created, and rebuilds the fixture. Running it twice yields the same state.
 *
 * Activity rows are inserted here directly with explicit timestamps; at runtime only
 * `src/server/activity.ts` writes that table. Synthetic data only: `@example.com`
 * emails, fictional addresses, no SSN, date of birth, income or credit fields.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// ---------------------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------
// Specimen documents (uploaded once to Blob by `pnpm seed:files`; the reset never deletes them)
// ---------------------------------------------------------------------------------------

type Specimen = "pay-stub" | "w2" | "bank-statement";

export const SPECIMENS: Record<
  Specimen,
  { pathname: string; sizeBytes: number }
> = {
  "pay-stub": { pathname: "seed/specimen-pay-stub.pdf", sizeBytes: 1_689 },
  w2: { pathname: "seed/specimen-w2.pdf", sizeBytes: 1_545 },
  "bank-statement": {
    pathname: "seed/specimen-bank-statement.pdf",
    sizeBytes: 1_801,
  },
};

/** The file beside `src/db/specimens/` that each Blob pathname is uploaded from. */
export const SPECIMEN_SOURCE_DIR = "src/db/specimens";

/**
 * `sizeBytes` above is what the needs list prints, so it must be what the download
 * actually sends. `pnpm seed:files` compares the two and refuses on a mismatch rather
 * than letting the UI quote a size no file has.
 */

function specimenFor(conditionTitle: string): Specimen {
  if (/pay stub/i.test(conditionTitle)) return "pay-stub";
  if (/bank statement/i.test(conditionTitle)) return "bank-statement";
  return "w2";
}

// ---------------------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------------------

type ConditionFixture = {
  title: string;
  instructions?: string;
  priorTo?: PriorTo;
  status?: ConditionStatus;
  /** Days before `now` the condition was created. */
  ageDays: number;
  clearedDaysAgo?: number;
  borrowerFacing?: boolean;
  lastRejectionReason?: string;
};

type DocumentFixture = {
  fileName: string;
  /** Title of the condition this document answers. */
  condition: string;
  via: "public_link" | "staff";
  uploadedBy?: UserKey;
  ageDays?: number;
  ageHours?: number;
  review: "pending" | "accepted" | "rejected";
  reviewedDaysAgo?: number;
  reviewedHoursAgo?: number;
  reason?: string;
};

type LoanFixture = {
  key: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerPhone?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  purpose: Purpose;
  loanType: LoanType;
  amount: number;
  purchasePrice?: number;
  loanOfficer: UserKey;
  referralSource: ReferralSource;
  stage: Stage;
  /** Days before `now` the loan entered its current stage (funded loans use `funded`). */
  daysInStage?: number;
  /** Days before `now` the loan was created (funded loans derive it from the cycle). */
  createdDaysAgo?: number;
  /** Days before `now` the application was taken; absent for leads and funded loans. */
  applicationDaysAgo?: number;
  targetCloseInDays?: number;
  /**
   * Funded loans are anchored to calendar months so the "Funded this month" tile and
   * its delta hold on any day: `daysAgo` is clamped into the current month; `monthsAgo`
   * plus `day` names a date in an earlier month. The application date is always
   * `cycleDays` (31–45) before funding, so cycle-time maths stays believable.
   */
  funded?:
    | { daysAgo: number; cycleDays: number }
    | { monthsAgo: number; day: number; cycleDays: number };
  /** Withdrawn and denied loans: the active stage they left from. */
  closedFrom?: ActiveStage;
  closedReason?: ClosedReason;
  /** Explicit conditions; otherwise the default needs list, all requested. */
  conditions?: ConditionFixture[];
  documents?: DocumentFixture[];
  /** Pre-approval facts shown to the borrower. */
  preapprovalAmount?: number;
  preapprovalExpiresInDays?: number;
};

/** The showcase loan: its public link is fixed to DEMO_SHOWCASE_TOKEN and sits on the login page. */
export const SHOWCASE_LOAN_KEY = "chen";

/** Every seeded condition that is not part of the default needs list, by title. */
const LOE = "Letter of explanation";
const GIFT = "Gift letter";
const APPRAISAL = "Appraisal received";

const LOANS: readonly LoanFixture[] = [
  // ---- Lead ----------------------------------------------------------------------------
  {
    key: "fischer",
    borrowerName: "Elena Fischer",
    borrowerEmail: "elena.fischer@example.com",
    borrowerPhone: "(208) 555-0161",
    street: "3 Quarry Rd",
    city: "Boise",
    state: "ID",
    zip: "83702",
    purpose: "purchase",
    loanType: "fha",
    amount: 274_000,
    purchasePrice: 290_000,
    loanOfficer: "morgan",
    referralSource: "realtor",
    stage: "lead",
    daysInStage: 4,
    createdDaysAgo: 4,
    preapprovalAmount: 285_000,
    preapprovalExpiresInDays: 86,
  },
  {
    key: "dubois",
    borrowerName: "Marc Dubois",
    borrowerEmail: "marc.dubois@example.com",
    borrowerPhone: "(520) 555-0119",
    street: "14 Cedar Row",
    city: "Tucson",
    state: "AZ",
    zip: "85701",
    purpose: "purchase",
    loanType: "fha",
    amount: 312_000,
    purchasePrice: 330_000,
    loanOfficer: "jordan",
    referralSource: "online",
    stage: "lead",
    daysInStage: 2,
    createdDaysAgo: 2,
  },
  {
    key: "haddad",
    borrowerName: "Layla Haddad",
    borrowerEmail: "layla.haddad@example.com",
    borrowerPhone: "(614) 555-0148",
    street: "71 Elm St",
    city: "Columbus",
    state: "OH",
    zip: "43215",
    purpose: "purchase",
    loanType: "conventional",
    amount: 560_000,
    purchasePrice: 700_000,
    loanOfficer: "alex",
    referralSource: "past_client",
    stage: "lead",
    daysInStage: 1,
    createdDaysAgo: 1,
    preapprovalAmount: 575_000,
    preapprovalExpiresInDays: 89,
  },
  // ---- Application ---------------------------------------------------------------------
  {
    key: "alvarez",
    borrowerName: "Diego Alvarez",
    borrowerEmail: "diego.alvarez@example.com",
    borrowerPhone: "(602) 555-0183",
    street: "640 Sunset Blvd",
    city: "Phoenix",
    state: "AZ",
    zip: "85004",
    purpose: "purchase",
    loanType: "conventional",
    amount: 529_900,
    purchasePrice: 589_000,
    loanOfficer: "alex",
    referralSource: "realtor",
    stage: "application",
    daysInStage: 1,
    createdDaysAgo: 3,
    applicationDaysAgo: 1,
    targetCloseInDays: 40,
    preapprovalAmount: 540_000,
    preapprovalExpiresInDays: 80,
  },
  {
    key: "larsen",
    borrowerName: "Ingrid Larsen",
    borrowerEmail: "ingrid.larsen@example.com",
    borrowerPhone: "(612) 555-0127",
    street: "22 Pinecrest Dr",
    city: "Minneapolis",
    state: "MN",
    zip: "55401",
    purpose: "purchase",
    loanType: "va",
    amount: 418_000,
    purchasePrice: 418_000,
    loanOfficer: "jordan",
    referralSource: "past_client",
    stage: "application",
    daysInStage: 3,
    createdDaysAgo: 5,
    applicationDaysAgo: 3,
    targetCloseInDays: 45,
  },
  // ---- Processing ----------------------------------------------------------------------
  {
    key: "chen",
    borrowerName: "Maria Chen",
    borrowerEmail: "maria.chen@example.com",
    borrowerPhone: "(512) 555-0198",
    street: "412 Maple Ave",
    city: "Austin",
    state: "TX",
    zip: "78704",
    purpose: "purchase",
    loanType: "conventional",
    amount: 485_000,
    purchasePrice: 540_000,
    loanOfficer: "alex",
    referralSource: "realtor",
    stage: "processing",
    daysInStage: 6,
    createdDaysAgo: 6,
    applicationDaysAgo: 6,
    targetCloseInDays: 27,
    preapprovalAmount: 500_000,
    preapprovalExpiresInDays: 70,
    conditions: [
      {
        title: "Government photo ID",
        ageDays: 6,
        status: "cleared",
        clearedDaysAgo: 5,
      },
      {
        title: "Pay stubs, last 30 days",
        ageDays: 6,
        status: "requested",
        lastRejectionReason: "pages are cut off",
      },
      {
        title: "W-2s, last 2 years",
        ageDays: 6,
        status: "received",
        instructions: "Your W-2 forms for 2024 and 2025.",
      },
      {
        title: "Bank statements, last 2 months",
        ageDays: 6,
        status: "requested",
        instructions:
          "All pages of your checking and savings statements for July and August.",
      },
      {
        title: "Purchase contract",
        ageDays: 6,
        status: "cleared",
        clearedDaysAgo: 4,
        instructions: "The signed contract for 412 Maple Ave.",
      },
      { title: "Homeowners insurance binder", ageDays: 6, status: "requested" },
    ],
    documents: [
      {
        fileName: "photo-id.pdf",
        condition: "Government photo ID",
        via: "public_link",
        ageDays: 5,
        review: "accepted",
        reviewedDaysAgo: 5,
      },
      {
        fileName: "purchase-contract.pdf",
        condition: "Purchase contract",
        via: "public_link",
        ageDays: 4,
        review: "accepted",
        reviewedDaysAgo: 4,
      },
      {
        fileName: "paystubs.pdf",
        condition: "Pay stubs, last 30 days",
        via: "public_link",
        ageDays: 3,
        review: "rejected",
        reviewedDaysAgo: 2,
        reason: "pages are cut off",
      },
      {
        fileName: "w2-2025.pdf",
        condition: "W-2s, last 2 years",
        via: "public_link",
        ageDays: 2,
        review: "pending",
      },
    ],
  },
  {
    key: "brooks",
    borrowerName: "Nathan Brooks",
    borrowerEmail: "nathan.brooks@example.com",
    borrowerPhone: "(608) 555-0154",
    street: "155 Lakeshore Ave",
    city: "Madison",
    state: "WI",
    zip: "53703",
    purpose: "purchase",
    loanType: "conventional",
    amount: 445_000,
    purchasePrice: 470_000,
    loanOfficer: "alex",
    referralSource: "online",
    stage: "processing",
    daysInStage: 12,
    createdDaysAgo: 14,
    applicationDaysAgo: 14,
    conditions: [
      {
        title: "Government photo ID",
        ageDays: 14,
        status: "cleared",
        clearedDaysAgo: 11,
      },
      { title: "Pay stubs, last 30 days", ageDays: 12, status: "requested" },
      { title: "W-2s, last 2 years", ageDays: 12, status: "requested" },
      {
        title: "Bank statements, last 2 months",
        ageDays: 12,
        status: "cleared",
        clearedDaysAgo: 10,
      },
      { title: "Purchase contract", ageDays: 12, status: "received" },
      {
        title: "Homeowners insurance binder",
        ageDays: 12,
        status: "requested",
      },
      {
        title: LOE,
        instructions:
          "A short note explaining the large deposit on your July statement.",
        ageDays: 5,
        status: "requested",
      },
    ],
    documents: [
      {
        fileName: "photo-id.pdf",
        condition: "Government photo ID",
        via: "public_link",
        ageDays: 12,
        review: "accepted",
        reviewedDaysAgo: 11,
      },
      {
        fileName: "bank-statements.pdf",
        condition: "Bank statements, last 2 months",
        via: "public_link",
        ageDays: 11,
        review: "accepted",
        reviewedDaysAgo: 10,
      },
      {
        fileName: "contract-signed.pdf",
        condition: "Purchase contract",
        via: "public_link",
        ageDays: 1,
        review: "pending",
      },
    ],
  },
  {
    key: "kim",
    borrowerName: "Hana Kim",
    borrowerEmail: "hana.kim@example.com",
    borrowerPhone: "(919) 555-0136",
    street: "9 Orchard St",
    city: "Raleigh",
    state: "NC",
    zip: "27601",
    purpose: "purchase",
    loanType: "conventional",
    amount: 389_000,
    purchasePrice: 410_000,
    loanOfficer: "alex",
    referralSource: "realtor",
    stage: "processing",
    daysInStage: 3,
    createdDaysAgo: 5,
    applicationDaysAgo: 5,
    targetCloseInDays: 9,
    conditions: [
      {
        title: "Government photo ID",
        ageDays: 5,
        status: "cleared",
        clearedDaysAgo: 4,
      },
      { title: "Pay stubs, last 30 days", ageDays: 3, status: "received" },
      { title: "W-2s, last 2 years", ageDays: 3, status: "requested" },
      {
        title: "Bank statements, last 2 months",
        ageDays: 3,
        status: "received",
      },
      {
        title: "Purchase contract",
        ageDays: 5,
        status: "cleared",
        clearedDaysAgo: 4,
      },
      { title: "Homeowners insurance binder", ageDays: 3, status: "requested" },
    ],
    documents: [
      {
        fileName: "photo-id.pdf",
        condition: "Government photo ID",
        via: "public_link",
        ageDays: 4,
        review: "accepted",
        reviewedDaysAgo: 4,
      },
      {
        fileName: "contract.pdf",
        condition: "Purchase contract",
        via: "staff",
        uploadedBy: "alex",
        ageDays: 4,
        review: "accepted",
        reviewedDaysAgo: 4,
      },
      {
        fileName: "bank-stmt-jul.pdf",
        condition: "Bank statements, last 2 months",
        via: "staff",
        uploadedBy: "sam",
        ageDays: 1,
        review: "pending",
      },
      {
        fileName: "paystubs-aug.pdf",
        condition: "Pay stubs, last 30 days",
        via: "public_link",
        ageHours: 6,
        review: "pending",
      },
    ],
  },
  // ---- Conditional approval ------------------------------------------------------------
  {
    key: "okonkwo",
    borrowerName: "Chidi Okonkwo",
    borrowerEmail: "chidi.okonkwo@example.com",
    borrowerPhone: "(303) 555-0172",
    street: "1901 Birch Ct",
    city: "Denver",
    state: "CO",
    zip: "80205",
    purpose: "purchase",
    loanType: "va",
    amount: 398_000,
    purchasePrice: 398_000,
    loanOfficer: "jordan",
    referralSource: "realtor",
    stage: "conditional_approval",
    daysInStage: 9,
    createdDaysAgo: 31,
    applicationDaysAgo: 30,
    conditions: [
      { title: "Government photo ID", ageDays: 20, status: "received" },
      {
        title: "Pay stubs, last 30 days",
        ageDays: 31,
        status: "cleared",
        clearedDaysAgo: 20,
      },
      {
        title: "W-2s, last 2 years",
        ageDays: 31,
        status: "cleared",
        clearedDaysAgo: 20,
      },
      {
        title: "Bank statements, last 2 months",
        ageDays: 31,
        status: "cleared",
        clearedDaysAgo: 19,
      },
      {
        title: "Purchase contract",
        ageDays: 31,
        status: "cleared",
        clearedDaysAgo: 25,
      },
      {
        title: "Homeowners insurance binder",
        ageDays: 20,
        status: "requested",
      },
      {
        title: APPRAISAL,
        ageDays: 16,
        status: "cleared",
        clearedDaysAgo: 10,
        borrowerFacing: false,
        priorTo: "approval",
      },
      {
        title: GIFT,
        instructions:
          "A signed letter from the person giving you funds for the down payment.",
        ageDays: 18,
        status: "cleared",
        clearedDaysAgo: 12,
      },
    ],
    documents: [
      {
        fileName: "paystubs.pdf",
        condition: "Pay stubs, last 30 days",
        via: "public_link",
        ageDays: 21,
        review: "accepted",
        reviewedDaysAgo: 20,
      },
      {
        fileName: "w2-2024-2025.pdf",
        condition: "W-2s, last 2 years",
        via: "public_link",
        ageDays: 21,
        review: "accepted",
        reviewedDaysAgo: 20,
      },
      {
        fileName: "bank-statements.pdf",
        condition: "Bank statements, last 2 months",
        via: "public_link",
        ageDays: 20,
        review: "accepted",
        reviewedDaysAgo: 19,
      },
      {
        fileName: "photo-id.pdf",
        condition: "Government photo ID",
        via: "public_link",
        ageHours: 1,
        review: "pending",
      },
    ],
  },
  {
    key: "patel",
    borrowerName: "Anika Patel",
    borrowerEmail: "anika.patel@example.com",
    borrowerPhone: "(813) 555-0165",
    street: "88 Harbor View Dr",
    city: "Tampa",
    state: "FL",
    zip: "33602",
    purpose: "purchase",
    loanType: "fha",
    amount: 612_500,
    purchasePrice: 650_000,
    loanOfficer: "alex",
    referralSource: "past_client",
    stage: "conditional_approval",
    daysInStage: 3,
    createdDaysAgo: 23,
    applicationDaysAgo: 22,
    targetCloseInDays: 20,
    conditions: [
      {
        title: "Government photo ID",
        ageDays: 23,
        status: "cleared",
        clearedDaysAgo: 21,
      },
      {
        title: "Pay stubs, last 30 days",
        ageDays: 23,
        status: "cleared",
        clearedDaysAgo: 19,
      },
      {
        title: "W-2s, last 2 years",
        ageDays: 23,
        status: "cleared",
        clearedDaysAgo: 19,
      },
      {
        title: "Bank statements, last 2 months",
        ageDays: 23,
        status: "cleared",
        clearedDaysAgo: 18,
      },
      {
        title: "Purchase contract",
        ageDays: 23,
        status: "cleared",
        clearedDaysAgo: 17,
      },
      { title: "Homeowners insurance binder", ageDays: 9, status: "requested" },
      {
        title: LOE,
        instructions: "A short note about the credit inquiry from August.",
        ageDays: 3,
        status: "requested",
      },
      {
        title: GIFT,
        instructions:
          "A signed letter from the person giving you funds for the down payment.",
        ageDays: 2,
        status: "requested",
      },
    ],
    documents: [
      {
        fileName: "paystubs.pdf",
        condition: "Pay stubs, last 30 days",
        via: "public_link",
        ageDays: 20,
        review: "accepted",
        reviewedDaysAgo: 19,
      },
      {
        fileName: "w2-2024-2025.pdf",
        condition: "W-2s, last 2 years",
        via: "public_link",
        ageDays: 20,
        review: "accepted",
        reviewedDaysAgo: 19,
      },
      {
        fileName: "bank-statements.pdf",
        condition: "Bank statements, last 2 months",
        via: "public_link",
        ageDays: 19,
        review: "accepted",
        reviewedDaysAgo: 18,
      },
    ],
  },
  {
    key: "moreau",
    borrowerName: "Claire Moreau",
    borrowerEmail: "claire.moreau@example.com",
    borrowerPhone: "(916) 555-0113",
    street: "5 Vineyard Ct",
    city: "Sacramento",
    state: "CA",
    zip: "95814",
    purpose: "purchase",
    loanType: "conventional",
    amount: 702_000,
    purchasePrice: 780_000,
    loanOfficer: "morgan",
    referralSource: "realtor",
    stage: "conditional_approval",
    daysInStage: 2,
    createdDaysAgo: 21,
    applicationDaysAgo: 20,
    targetCloseInDays: 24,
    conditions: [
      {
        title: "Government photo ID",
        ageDays: 21,
        status: "cleared",
        clearedDaysAgo: 19,
      },
      {
        title: "Pay stubs, last 30 days",
        ageDays: 21,
        status: "cleared",
        clearedDaysAgo: 17,
      },
      {
        title: "W-2s, last 2 years",
        ageDays: 21,
        status: "cleared",
        clearedDaysAgo: 17,
      },
      {
        title: "Bank statements, last 2 months",
        ageDays: 21,
        status: "cleared",
        clearedDaysAgo: 16,
      },
      {
        title: "Purchase contract",
        ageDays: 21,
        status: "cleared",
        clearedDaysAgo: 18,
      },
      { title: "Homeowners insurance binder", ageDays: 4, status: "requested" },
      {
        title: LOE,
        instructions: "A short note about the gap in employment last spring.",
        ageDays: 1,
        status: "requested",
      },
    ],
    documents: [
      {
        fileName: "paystubs.pdf",
        condition: "Pay stubs, last 30 days",
        via: "public_link",
        ageDays: 18,
        review: "accepted",
        reviewedDaysAgo: 17,
      },
      {
        fileName: "w2s.pdf",
        condition: "W-2s, last 2 years",
        via: "public_link",
        ageDays: 18,
        review: "accepted",
        reviewedDaysAgo: 17,
      },
    ],
  },
  // ---- Clear to close ------------------------------------------------------------------
  {
    key: "nguyen",
    borrowerName: "Linh Nguyen",
    borrowerEmail: "linh.nguyen@example.com",
    borrowerPhone: "(503) 555-0129",
    street: "27 Willow Ln",
    city: "Portland",
    state: "OR",
    zip: "97209",
    purpose: "refinance",
    loanType: "conventional",
    amount: 355_000,
    loanOfficer: "jordan",
    referralSource: "past_client",
    stage: "clear_to_close",
    daysInStage: 2,
    createdDaysAgo: 34,
    applicationDaysAgo: 33,
    targetCloseInDays: 13,
    conditions: [
      {
        title: "Government photo ID",
        ageDays: 34,
        status: "cleared",
        clearedDaysAgo: 31,
      },
      {
        title: "Pay stubs, last 30 days",
        ageDays: 34,
        status: "cleared",
        clearedDaysAgo: 28,
      },
      {
        title: "W-2s, last 2 years",
        ageDays: 34,
        status: "cleared",
        clearedDaysAgo: 28,
      },
      {
        title: "Bank statements, last 2 months",
        ageDays: 34,
        status: "cleared",
        clearedDaysAgo: 27,
      },
      {
        title: "Mortgage statement",
        ageDays: 34,
        status: "cleared",
        clearedDaysAgo: 30,
      },
      {
        title: "Homeowners insurance declarations",
        ageDays: 5,
        status: "requested",
      },
      {
        title: LOE,
        instructions: "A short note about the recent credit inquiry.",
        ageDays: 1,
        status: "requested",
        priorTo: "funding",
      },
    ],
    documents: [
      {
        fileName: "paystubs.pdf",
        condition: "Pay stubs, last 30 days",
        via: "public_link",
        ageDays: 29,
        review: "accepted",
        reviewedDaysAgo: 28,
      },
      {
        fileName: "bank-statements.pdf",
        condition: "Bank statements, last 2 months",
        via: "public_link",
        ageDays: 28,
        review: "accepted",
        reviewedDaysAgo: 27,
      },
    ],
  },
  {
    key: "sato",
    borrowerName: "Kenji Sato",
    borrowerEmail: "kenji.sato@example.com",
    borrowerPhone: "(619) 555-0141",
    street: "300 Bayfront Way",
    city: "San Diego",
    state: "CA",
    zip: "92101",
    purpose: "purchase",
    loanType: "conventional",
    amount: 720_000,
    purchasePrice: 900_000,
    loanOfficer: "morgan",
    referralSource: "realtor",
    stage: "clear_to_close",
    daysInStage: 1,
    createdDaysAgo: 37,
    applicationDaysAgo: 36,
    targetCloseInDays: 6,
    conditions: [
      {
        title: "Government photo ID",
        ageDays: 37,
        status: "cleared",
        clearedDaysAgo: 34,
      },
      {
        title: "Pay stubs, last 30 days",
        ageDays: 37,
        status: "cleared",
        clearedDaysAgo: 30,
      },
      {
        title: "W-2s, last 2 years",
        ageDays: 37,
        status: "cleared",
        clearedDaysAgo: 30,
      },
      {
        title: "Bank statements, last 2 months",
        ageDays: 37,
        status: "cleared",
        clearedDaysAgo: 29,
      },
      {
        title: "Purchase contract",
        ageDays: 37,
        status: "cleared",
        clearedDaysAgo: 33,
      },
      { title: "Homeowners insurance binder", ageDays: 3, status: "requested" },
      {
        title: APPRAISAL,
        ageDays: 20,
        status: "cleared",
        clearedDaysAgo: 12,
        borrowerFacing: false,
        priorTo: "approval",
      },
    ],
    documents: [
      {
        fileName: "paystubs.pdf",
        condition: "Pay stubs, last 30 days",
        via: "public_link",
        ageDays: 31,
        review: "accepted",
        reviewedDaysAgo: 30,
      },
      {
        fileName: "w2s.pdf",
        condition: "W-2s, last 2 years",
        via: "public_link",
        ageDays: 31,
        review: "accepted",
        reviewedDaysAgo: 30,
      },
      {
        fileName: "bank-statements.pdf",
        condition: "Bank statements, last 2 months",
        via: "staff",
        uploadedBy: "sam",
        ageDays: 30,
        review: "accepted",
        reviewedDaysAgo: 29,
      },
    ],
  },
  // ---- Funded this month ---------------------------------------------------------------
  {
    key: "rivera",
    borrowerName: "Sofia Rivera",
    borrowerEmail: "sofia.rivera@example.com",
    borrowerPhone: "(915) 555-0188",
    street: "18 Foxglove Ln",
    city: "El Paso",
    state: "TX",
    zip: "79901",
    purpose: "purchase",
    loanType: "conventional",
    amount: 410_000,
    purchasePrice: 455_000,
    loanOfficer: "alex",
    referralSource: "realtor",
    stage: "funded",
    funded: { daysAgo: 9, cycleDays: 38 },
  },
  {
    key: "sandoval",
    borrowerName: "Luis Sandoval",
    borrowerEmail: "luis.sandoval@example.com",
    borrowerPhone: "(402) 555-0123",
    street: "902 Prairie Ct",
    city: "Omaha",
    state: "NE",
    zip: "68102",
    purpose: "purchase",
    loanType: "fha",
    amount: 352_000,
    purchasePrice: 365_000,
    loanOfficer: "alex",
    referralSource: "online",
    stage: "funded",
    funded: { daysAgo: 4, cycleDays: 41 },
  },
  {
    key: "whitaker",
    borrowerName: "Grace Whitaker",
    borrowerEmail: "grace.whitaker@example.com",
    borrowerPhone: "(401) 555-0157",
    street: "47 Beacon St",
    city: "Providence",
    state: "RI",
    zip: "02903",
    purpose: "purchase",
    loanType: "conventional",
    amount: 598_000,
    purchasePrice: 640_000,
    loanOfficer: "morgan",
    referralSource: "past_client",
    stage: "funded",
    funded: { daysAgo: 1, cycleDays: 36 },
  },
  {
    key: "osei",
    borrowerName: "Kwame Osei",
    borrowerEmail: "kwame.osei@example.com",
    borrowerPhone: "(615) 555-0174",
    street: "1200 Ridgeway Dr",
    city: "Nashville",
    state: "TN",
    zip: "37203",
    purpose: "purchase",
    loanType: "va",
    amount: 540_000,
    purchasePrice: 540_000,
    loanOfficer: "jordan",
    referralSource: "realtor",
    stage: "funded",
    funded: { daysAgo: 12, cycleDays: 40 },
  },
  // ---- Funded last month ---------------------------------------------------------------
  {
    key: "lindqvist",
    borrowerName: "Erik Lindqvist",
    borrowerEmail: "erik.lindqvist@example.com",
    borrowerPhone: "(207) 555-0139",
    street: "8 Harbor Ln",
    city: "Portland",
    state: "ME",
    zip: "04101",
    purpose: "refinance",
    loanType: "conventional",
    amount: 318_000,
    loanOfficer: "alex",
    referralSource: "past_client",
    stage: "funded",
    funded: { monthsAgo: 1, day: 12, cycleDays: 42 },
  },
  {
    key: "mbeki",
    borrowerName: "Thandi Mbeki",
    borrowerEmail: "thandi.mbeki@example.com",
    borrowerPhone: "(704) 555-0192",
    street: "66 Sycamore Ave",
    city: "Charlotte",
    state: "NC",
    zip: "28202",
    purpose: "purchase",
    loanType: "fha",
    amount: 287_500,
    purchasePrice: 300_000,
    loanOfficer: "jordan",
    referralSource: "online",
    stage: "funded",
    funded: { monthsAgo: 1, day: 9, cycleDays: 40 },
  },
  // ---- Funded two and three months ago -------------------------------------------------
  {
    key: "costa",
    borrowerName: "Rafael Costa",
    borrowerEmail: "rafael.costa@example.com",
    borrowerPhone: "(505) 555-0116",
    street: "315 Juniper St",
    city: "Albuquerque",
    state: "NM",
    zip: "87102",
    purpose: "purchase",
    loanType: "conventional",
    amount: 462_000,
    purchasePrice: 485_000,
    loanOfficer: "morgan",
    referralSource: "realtor",
    stage: "funded",
    funded: { monthsAgo: 2, day: 18, cycleDays: 39 },
  },
  {
    key: "novak",
    borrowerName: "Petra Novak",
    borrowerEmail: "petra.novak@example.com",
    borrowerPhone: "(208) 555-0145",
    street: "21 Kestrel Way",
    city: "Boise",
    state: "ID",
    zip: "83702",
    purpose: "purchase",
    loanType: "conventional",
    amount: 395_000,
    purchasePrice: 420_000,
    loanOfficer: "alex",
    referralSource: "realtor",
    stage: "funded",
    funded: { monthsAgo: 3, day: 27, cycleDays: 34 },
  },
  {
    key: "delacroix",
    borrowerName: "Amelie Delacroix",
    borrowerEmail: "amelie.delacroix@example.com",
    borrowerPhone: "(225) 555-0108",
    street: "730 Magnolia Blvd",
    city: "Baton Rouge",
    state: "LA",
    zip: "70802",
    purpose: "purchase",
    loanType: "va",
    amount: 331_000,
    purchasePrice: 331_000,
    loanOfficer: "jordan",
    referralSource: "past_client",
    stage: "funded",
    funded: { monthsAgo: 3, day: 6, cycleDays: 42 },
  },
  // ---- Withdrawn and denied ------------------------------------------------------------
  {
    key: "park",
    borrowerName: "Jisoo Park",
    borrowerEmail: "jisoo.park@example.com",
    borrowerPhone: "(509) 555-0133",
    street: "14 Alder Ct",
    city: "Spokane",
    state: "WA",
    zip: "99201",
    purpose: "purchase",
    loanType: "conventional",
    amount: 375_000,
    purchasePrice: 395_000,
    loanOfficer: "alex",
    referralSource: "online",
    stage: "withdrawn",
    daysInStage: 20,
    createdDaysAgo: 72,
    applicationDaysAgo: 70,
    closedFrom: "processing",
    closedReason: "withdrawn_by_applicant",
  },
  {
    key: "hughes",
    borrowerName: "Owen Hughes",
    borrowerEmail: "owen.hughes@example.com",
    borrowerPhone: "(918) 555-0121",
    street: "502 Willow Bend",
    city: "Tulsa",
    state: "OK",
    zip: "74103",
    purpose: "purchase",
    loanType: "fha",
    amount: 240_000,
    purchasePrice: 250_000,
    loanOfficer: "morgan",
    referralSource: "realtor",
    stage: "withdrawn",
    daysInStage: 8,
    createdDaysAgo: 27,
    applicationDaysAgo: 25,
    closedFrom: "application",
    closedReason: "other",
  },
  {
    key: "ferreira",
    borrowerName: "Bruno Ferreira",
    borrowerEmail: "bruno.ferreira@example.com",
    borrowerPhone: "(775) 555-0166",
    street: "9 Summit Ave",
    city: "Reno",
    state: "NV",
    zip: "89501",
    purpose: "purchase",
    loanType: "conventional",
    amount: 510_000,
    purchasePrice: 540_000,
    loanOfficer: "jordan",
    referralSource: "online",
    stage: "denied",
    daysInStage: 15,
    createdDaysAgo: 77,
    applicationDaysAgo: 75,
    closedFrom: "underwriting",
    closedReason: "credit",
  },
];

// ---------------------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------------------

function ago(now: Date, days: number, hours = 0): Date {
  return new Date(now.getTime() - days * DAY_MS - hours * HOUR_MS);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Noon UTC on the first day of `now`'s month, so "funded this month" holds on any day. */
function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12));
}

/** When a funded loan funded, anchored to the calendar and never in the future. */
function fundedAtFor(
  now: Date,
  spec: NonNullable<LoanFixture["funded"]>,
): Date {
  if ("daysAgo" in spec) {
    const first = startOfMonth(now);
    const at = ago(now, spec.daysAgo, 7);
    return at < first ? first : at;
  }
  const at = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - spec.monthsAgo,
      spec.day,
      14,
    ),
  );
  return at < now ? at : ago(now, 0, 1);
}

/** A stable UUID (version 5 layout) from the fixture key, so deep links survive a reset. */
function loanIdFor(key: string): string {
  const digest = createHash("sha1").update(`clearline:loan:${key}`).digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** The stages a loan passed through to reach `stage`, in order. */
function pathTo(stage: Stage, closedFrom?: ActiveStage): Stage[] {
  if (isActiveStage(stage))
    return ACTIVE_STAGES.slice(0, stageIndex(stage) + 1);
  if (stage === "funded") return [...ACTIVE_STAGES, "funded"];
  const from = closedFrom ?? "lead";
  return [...ACTIVE_STAGES.slice(0, stageIndex(from) + 1), stage];
}

/**
 * When each stage on the path was entered: lead at creation, application on the
 * application date, the last stage at `stageEnteredAt`, and anything in between spread
 * evenly, so turn-time maths has believable rows to work with.
 */
function stageTimeline(
  path: Stage[],
  createdAt: Date,
  applicationAt: Date | null,
  stageEnteredAt: Date,
): { stage: Stage; at: Date }[] {
  const timeline: { stage: Stage; at: Date }[] = [];
  const last = path.length - 1;
  const startIndex = applicationAt ? 1 : 0;
  const start = applicationAt ?? createdAt;
  for (let i = 0; i <= last; i += 1) {
    const stage = path[i];
    let at: Date;
    if (i === 0) at = createdAt;
    else if (i === last) at = stageEnteredAt;
    else if (i === 1 && applicationAt) at = applicationAt;
    else {
      const steps = last - startIndex;
      const fraction = (i - startIndex) / steps;
      at = new Date(
        start.getTime() +
          (stageEnteredAt.getTime() - start.getTime()) * fraction,
      );
    }
    timeline.push({ stage, at });
  }
  return timeline;
}

/** 32 URL-safe characters derived deterministically from the loan key. */
function uploadTokenFor(key: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const ch of `${key}:clearline`) {
    h1 = Math.imul(h1 ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + ch.charCodeAt(0), 0x9e3779b1) >>> 0;
  }
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  let x = h1;
  let y = h2;
  for (let i = 0; i < 32; i += 1) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    y = (Math.imul(y ^ (y >>> 13), 2654435761) + i) >>> 0;
    // `^` yields a signed 32-bit int, so the high bit made this index negative and the
    // token came out as a run of "undefined". Coerce back to unsigned before the modulo.
    out += alphabet[((x ^ y) >>> 0) % alphabet.length];
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------------------

export type SeedOptions = {
  now: Date;
  demoPassword: string;
  showcaseToken: string;
  /** `reset` also records a `demo.reset` activity row. */
  mode: "seed" | "reset";
};

export type SeedSummary = {
  users: number;
  loans: number;
  loansByStage: Partial<Record<Stage, number>>;
  conditions: number;
  documents: number;
  activity: number;
};

export async function seedFixture(
  db: Db,
  options: SeedOptions,
): Promise<SeedSummary> {
  const { now, mode } = options;
  const passwordHash = await hashPassword(options.demoPassword);
  const summary: SeedSummary = {
    users: 0,
    loans: 0,
    loansByStage: {},
    conditions: 0,
    documents: 0,
    activity: 0,
  };

  await db.transaction(async (tx) => {
    // One statement, so the cascades and the append-only triggers never get a say.
    await tx.execute(
      sql`truncate table ${loans}, ${conditions}, ${documents}, ${activity} restart identity`,
    );

    // Staff: drop anyone a visitor created (nothing references them once the app tables
    // are empty; sessions and accounts cascade), then restore the six accounts.
    await tx.delete(user).where(notInArray(user.id, Object.values(USER_ID)));
    for (const u of DEMO_USERS) {
      const createdAt = ago(now, u.createdDaysAgo);
      const row = {
        name: u.name,
        email: u.email,
        emailVerified: true,
        role: u.role,
        nmlsId: u.nmlsId ?? null,
        phone: u.phone ?? null,
        banned: false,
        banReason: null,
        banExpires: null,
        updatedAt: now,
      };
      await tx
        .insert(user)
        .values({ id: u.id, ...row, createdAt })
        .onConflictDoUpdate({ target: user.id, set: row });
      const credential = {
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
        password: passwordHash,
        updatedAt: now,
      };
      await tx
        .insert(account)
        .values({ id: `acc_${u.key}`, ...credential, createdAt })
        .onConflictDoUpdate({ target: account.id, set: credential });
    }
    summary.users = DEMO_USERS.length;

    const rows: NewActivity[] = [];
    const record = (
      row: Omit<NewActivity, "actorKind"> & {
        actorKind?: NewActivity["actorKind"];
      },
    ) => {
      rows.push({ actorKind: row.actorId ? "user" : "system", ...row });
    };

    // Riley was created by Priya five days ago.
    const riley = demoUser("riley");
    record({
      action: "admin.user_created" satisfies ActivityAction,
      actorId: USER_ID.priya,
      detail: { userId: riley.id, name: riley.name, role: riley.role },
      createdAt: ago(now, riley.createdDaysAgo),
    });

    for (const fixture of LOANS) {
      const loanOfficerId = USER_ID[fixture.loanOfficer];
      let createdAt: Date;
      let applicationAt: Date | null;
      let stageEnteredAt: Date;
      if (fixture.funded) {
        stageEnteredAt = fundedAtFor(now, fixture.funded);
        applicationAt = new Date(
          stageEnteredAt.getTime() - fixture.funded.cycleDays * DAY_MS,
        );
        createdAt = new Date(applicationAt.getTime() - 2 * DAY_MS);
      } else {
        if (
          fixture.daysInStage === undefined ||
          fixture.createdDaysAgo === undefined
        ) {
          throw new Error(
            `${fixture.key}: daysInStage and createdDaysAgo are required`,
          );
        }
        createdAt = ago(now, fixture.createdDaysAgo, 9);
        applicationAt =
          fixture.applicationDaysAgo === undefined
            ? null
            : ago(now, fixture.applicationDaysAgo, 8);
        stageEnteredAt = ago(now, fixture.daysInStage, 7);
      }
      const ageDays = Math.round(
        (now.getTime() - createdAt.getTime()) / DAY_MS,
      );
      const stageDays = Math.round(
        (now.getTime() - stageEnteredAt.getTime()) / DAY_MS,
      );
      const path = pathTo(fixture.stage, fixture.closedFrom);
      const passedProcessing = path.includes("processing");
      const isTerminal = !isActiveStage(fixture.stage);

      const [loan] = await tx
        .insert(loans)
        .values({
          id: loanIdFor(fixture.key),
          borrowerName: fixture.borrowerName,
          borrowerEmail: fixture.borrowerEmail,
          borrowerPhone: fixture.borrowerPhone ?? null,
          propertyStreet: fixture.street,
          propertyCity: fixture.city,
          propertyState: fixture.state,
          propertyZip: fixture.zip,
          purpose: fixture.purpose,
          loanType: fixture.loanType,
          amount: fixture.amount,
          purchasePrice: fixture.purchasePrice ?? null,
          stage: fixture.stage,
          stageEnteredAt,
          applicationDate: applicationAt ? isoDate(applicationAt) : null,
          targetCloseDate:
            fixture.targetCloseInDays === undefined
              ? null
              : isoDate(ago(now, -fixture.targetCloseInDays)),
          fundedAt: fixture.stage === "funded" ? stageEnteredAt : null,
          closedReason: fixture.closedReason ?? null,
          preapprovalAmount: fixture.preapprovalAmount ?? null,
          preapprovalExpiresOn:
            fixture.preapprovalExpiresInDays === undefined
              ? null
              : isoDate(ago(now, -fixture.preapprovalExpiresInDays)),
          loanOfficerId,
          processorId: passedProcessing ? USER_ID.sam : null,
          referralSource: fixture.referralSource,
          uploadToken:
            fixture.key === SHOWCASE_LOAN_KEY
              ? options.showcaseToken
              : uploadTokenFor(fixture.key),
          createdAt,
          updatedAt: isTerminal ? stageEnteredAt : now,
        })
        .returning({ id: loans.id });
      summary.loans += 1;
      summary.loansByStage[fixture.stage] =
        (summary.loansByStage[fixture.stage] ?? 0) + 1;

      // Stage history.
      record({
        loanId: loan.id,
        actorId: loanOfficerId,
        action: "loan.created",
        detail: {},
        createdAt,
      });
      const timeline = stageTimeline(
        path,
        createdAt,
        applicationAt,
        stageEnteredAt,
      );
      for (let i = 1; i < timeline.length; i += 1) {
        const from = timeline[i - 1].stage;
        const to = timeline[i].stage;
        const lateMove =
          to === "denied" ||
          to === "funded" ||
          (isActiveStage(to) && stageIndex(to) > stageIndex("processing"));
        const detail: Record<string, unknown> = { from, to };
        if (fixture.closedReason && (to === "withdrawn" || to === "denied")) {
          detail.closedReason = fixture.closedReason;
        }
        record({
          loanId: loan.id,
          actorId: lateMove ? USER_ID.sam : loanOfficerId,
          action: "loan.stage_changed",
          detail,
          createdAt: timeline[i].at,
        });
      }

      // Conditions: the explicit list, or the default needs list for this purpose.
      const defaults = defaultNeedsList(fixture.purpose);
      const conditionFixtures: ConditionFixture[] =
        fixture.conditions ??
        defaults.map((item) => ({
          title: item.title,
          ageDays,
          status: fixture.stage === "funded" ? "cleared" : "requested",
          clearedDaysAgo:
            fixture.stage === "funded" ? stageDays + 3 : undefined,
        }));
      const conditionIdByTitle = new Map<string, string>();
      for (const c of conditionFixtures) {
        const template = defaults.find((d) => d.title === c.title);
        const status = c.status ?? "requested";
        const conditionCreatedAt = ago(now, c.ageDays, 10);
        const clearedAt =
          status === "cleared"
            ? ago(now, c.clearedDaysAgo ?? c.ageDays, 11)
            : null;
        const [condition] = await tx
          .insert(conditions)
          .values({
            loanId: loan.id,
            title: c.title,
            instructions: c.instructions ?? template?.instructions ?? null,
            status,
            priorTo: c.priorTo ?? template?.priorTo ?? "docs",
            borrowerFacing: c.borrowerFacing ?? true,
            lastRejectionReason: c.lastRejectionReason ?? null,
            clearedBy: clearedAt ? USER_ID.sam : null,
            clearedAt,
            createdBy: loanOfficerId,
            createdAt: conditionCreatedAt,
            updatedAt: clearedAt ?? conditionCreatedAt,
          })
          .returning({ id: conditions.id });
        conditionIdByTitle.set(c.title, condition.id);
        summary.conditions += 1;
        if (clearedAt) {
          record({
            loanId: loan.id,
            actorId: USER_ID.sam,
            action: "condition.cleared",
            detail: { conditionId: condition.id, title: c.title },
            createdAt: clearedAt,
          });
        }
      }

      // Documents: the explicit list, or one accepted specimen per cleared condition for
      // files that passed processing, so downloads and the review loop have material.
      const documentFixtures: DocumentFixture[] =
        fixture.documents ??
        (passedProcessing
          ? conditionFixtures
              .filter(
                (c) => c.status === "cleared" && (c.borrowerFacing ?? true),
              )
              .slice(0, 3)
              .map((c) => ({
                fileName: `${c.title
                  .split(",")[0]
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")}.pdf`,
                condition: c.title,
                via: "public_link" as const,
                ageDays: (c.clearedDaysAgo ?? c.ageDays) + 1,
                review: "accepted" as const,
                reviewedDaysAgo: c.clearedDaysAgo ?? c.ageDays,
              }))
          : []);
      for (const d of documentFixtures) {
        const conditionId = conditionIdByTitle.get(d.condition);
        if (!conditionId)
          throw new Error(
            `${fixture.key}: no condition "${d.condition}" for ${d.fileName}`,
          );
        const specimen = SPECIMENS[specimenFor(d.condition)];
        const uploadedAt = ago(now, d.ageDays ?? 0, d.ageHours ?? 0);
        const reviewedAt =
          d.review === "pending"
            ? null
            : ago(now, d.reviewedDaysAgo ?? 0, d.reviewedHoursAgo ?? 0);
        const uploadedBy =
          d.via === "staff" ? USER_ID[d.uploadedBy ?? "sam"] : null;
        const [document] = await tx
          .insert(documents)
          .values({
            loanId: loan.id,
            conditionId,
            uploadedBy,
            uploadedVia: d.via,
            fileName: d.fileName,
            blobPathname: specimen.pathname,
            contentType: "application/pdf",
            sizeBytes: specimen.sizeBytes,
            docType: null,
            reviewStatus: d.review,
            reviewReason: d.reason ?? null,
            reviewedBy: reviewedAt ? USER_ID.sam : null,
            reviewedAt,
            createdAt: uploadedAt,
          })
          .returning({ id: documents.id });
        summary.documents += 1;
        record({
          loanId: loan.id,
          actorId: uploadedBy,
          actorKind: uploadedBy ? "user" : "public_link",
          action: "document.uploaded",
          detail: {
            documentId: document.id,
            fileName: d.fileName,
            conditionId,
            via: d.via,
            econsent: d.via === "public_link" ? true : undefined,
          },
          createdAt: uploadedAt,
        });
        if (reviewedAt) {
          record({
            loanId: loan.id,
            actorId: USER_ID.sam,
            action:
              d.review === "accepted"
                ? "document.accepted"
                : "document.rejected",
            detail: {
              documentId: document.id,
              fileName: d.fileName,
              conditionId,
              reason: d.reason,
            },
            createdAt: reviewedAt,
          });
        }
      }
    }

    if (mode === "reset") {
      record({
        action: "demo.reset",
        actorKind: "system",
        detail: {},
        createdAt: now,
      });
    }

    rows.sort(
      (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
    );
    for (const row of rows) {
      await tx.insert(activity).values({
        ...row,
        detail: Object.fromEntries(
          Object.entries(row.detail ?? {}).filter(([, v]) => v !== undefined),
        ),
      });
    }
    summary.activity = rows.length;
  });

  return summary;
}

/** Ids of the seeded staff, for callers that need to look one up (tests, sanity checks). */
export function demoUserIds(): string[] {
  return Object.values(USER_ID);
}

/** Loans in the fixture whose stage is one of `stages`; handy for tests. */
export function fixtureLoans(stages?: readonly Stage[]) {
  return LOANS.filter((l) => !stages || stages.includes(l.stage)).map((l) => ({
    key: l.key,
    borrowerName: l.borrowerName,
    street: l.street,
    amount: l.amount,
    stage: l.stage,
    loanOfficer: l.loanOfficer,
  }));
}

export const FIXTURE_LOAN_COUNT = LOANS.length;
