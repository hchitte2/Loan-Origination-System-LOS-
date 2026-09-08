import { and, asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { documents, loans, user } from "@/db/schema";
import type { LoanType, Purpose, ReferralSource } from "@/lib/loan-facts";
import type { ClosedReason, Stage } from "@/lib/stages";
import type { Actor } from "../actor";
import { assertCan, can, loanScope } from "../authz";

/**
 * Loan reads for the pipeline surfaces (PLAN.md §2 "Loans: read scope"). Every staff
 * role sees every loan, terminal ones included; the board and the list decide which
 * stages they draw. "Mine" narrows to the actor's own loans and is a filter, not a
 * permission — `loan.read` is `any` for all three roles.
 */

export type PipelineLoan = {
  id: string;
  /** "Maria Chen" — the full name, for the list's Borrower column and the card's label. */
  borrowerName: string;
  /** "Chen" — what the board card and the loan heading show. */
  familyName: string;
  propertyStreet: string;
  propertyCity: string;
  propertyState: string;
  stage: Stage;
  stageEnteredAt: Date;
  /** Set the first time the loan reaches Application; the stage machine reads it. */
  applicationDate: string | null;
  loanType: LoanType;
  amount: number;
  targetCloseDate: string | null;
  fundedAt: Date | null;
  loanOfficerId: string;
  loanOfficerName: string;
  /** Documents still waiting on a reviewer; drives the "Needs review" tag. */
  pendingDocuments: number;
};

/** "Maria Chen" → "Chen". Staff refer to a file by the borrower's family name. */
export function familyName(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

export async function listPipelineLoans(
  actor: Actor,
  options: { mine?: boolean } = {},
): Promise<PipelineLoan[]> {
  assertCan(actor, "loan.read");
  const pendingDocs = db()
    .select({
      loanId: documents.loanId,
      n: sql<number>`count(*)::int`.as("n"),
    })
    .from(documents)
    .where(eq(documents.reviewStatus, "pending"))
    .groupBy(documents.loanId)
    .as("pending_docs");

  const rows = await db()
    .select({
      id: loans.id,
      borrowerName: loans.borrowerName,
      propertyStreet: loans.propertyStreet,
      propertyCity: loans.propertyCity,
      propertyState: loans.propertyState,
      stage: loans.stage,
      stageEnteredAt: loans.stageEnteredAt,
      applicationDate: loans.applicationDate,
      loanType: loans.loanType,
      amount: loans.amount,
      targetCloseDate: loans.targetCloseDate,
      fundedAt: loans.fundedAt,
      loanOfficerId: loans.loanOfficerId,
      loanOfficerName: user.name,
      pendingDocuments: pendingDocs.n,
    })
    .from(loans)
    .innerJoin(user, eq(user.id, loans.loanOfficerId))
    .leftJoin(pendingDocs, eq(pendingDocs.loanId, loans.id))
    .where(
      and(
        loanScope(actor, "read"),
        options.mine ? eq(loans.loanOfficerId, actor.userId) : undefined,
      ),
    )
    // Pipeline order, then oldest in stage first. The list reads down the funnel the way
    // the design frame shows it, and each board column gets the files that have stopped
    // moving at the top. Postgres orders the enum by its declared order, which is the
    // order of `STAGES`. (The frames' order within a column is the fixture's declaration
    // order, which no query can reproduce from the data.)
    .orderBy(asc(loans.stage), asc(loans.stageEnteredAt), asc(loans.id));

  return rows.map((row) => ({
    ...row,
    familyName: familyName(row.borrowerName),
    pendingDocuments: row.pendingDocuments ?? 0,
  }));
}

/** The slice of a loan a stage move needs, plus what its activity sentence will say. */
export type LoanForAction = {
  id: string;
  borrowerName: string;
  familyName: string;
  stage: Stage;
  loanOfficerId: string;
  applicationDate: string | null;
};

/**
 * One loan, for an action about to change it. Reads are unscoped for every staff role
 * (`loanScope(actor, "read")` is `undefined`), so this returns any existing loan and the
 * caller decides with `can()` whether the actor may write to it. Null means 404.
 */
export async function getLoanForAction(
  actor: Actor,
  loanId: string,
): Promise<LoanForAction | null> {
  assertCan(actor, "loan.read");
  const [row] = await db()
    .select({
      id: loans.id,
      borrowerName: loans.borrowerName,
      stage: loans.stage,
      loanOfficerId: loans.loanOfficerId,
      applicationDate: loans.applicationDate,
    })
    .from(loans)
    .where(and(eq(loans.id, loanId), loanScope(actor, "read")))
    .limit(1);
  if (!row) return null;
  return { ...row, familyName: familyName(row.borrowerName) };
}

/** Everything the loan detail header and Overview tab render. */
export type LoanDetail = {
  id: string;
  borrowerName: string;
  familyName: string;
  /** "Maria" — the borrower link buttons say whose link it is. */
  borrowerFirstName: string;
  borrowerEmail: string;
  borrowerPhone: string | null;
  propertyStreet: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  purpose: Purpose;
  loanType: LoanType;
  amount: number;
  purchasePrice: number | null;
  referralSource: ReferralSource;
  stage: Stage;
  stageEnteredAt: Date;
  applicationDate: string | null;
  targetCloseDate: string | null;
  fundedAt: Date | null;
  closedReason: ClosedReason | null;
  createdAt: Date;
  loanOfficerId: string;
  loanOfficer: LoanPerson;
  processor: LoanPerson | null;
  /**
   * Only for an actor who may manage the link (`loan.manage_link`). The token is the
   * borrower's whole authentication, so it is projected here rather than fetched and
   * hidden in a component: a Server Component serialises whatever the page fetched.
   */
  uploadToken: string | null;
};

export type LoanPerson = {
  id: string;
  name: string;
  nmlsId: string | null;
  phone: string | null;
};

/**
 * One loan with the people on it. Returns null when there is no such loan, which the
 * page turns into a 404. `assertCan(loan.read)` runs first; the upload token is dropped
 * unless the actor may manage the link.
 */
export async function getLoanDetail(
  actor: Actor,
  loanId: string,
): Promise<LoanDetail | null> {
  assertCan(actor, "loan.read");
  const officer = alias(user, "loan_officer");
  const processor = alias(user, "processor");
  const [row] = await db()
    .select({
      // Named, not `loans` wholesale: the upload token is the borrower's whole
      // authentication, and a spread would carry it — and any column added later — into
      // the payload where only statement order kept it out. Listing the columns makes
      // tsc the guard instead of a habit.
      id: loans.id,
      borrowerName: loans.borrowerName,
      borrowerEmail: loans.borrowerEmail,
      borrowerPhone: loans.borrowerPhone,
      propertyStreet: loans.propertyStreet,
      propertyCity: loans.propertyCity,
      propertyState: loans.propertyState,
      propertyZip: loans.propertyZip,
      purpose: loans.purpose,
      loanType: loans.loanType,
      amount: loans.amount,
      purchasePrice: loans.purchasePrice,
      referralSource: loans.referralSource,
      stage: loans.stage,
      stageEnteredAt: loans.stageEnteredAt,
      applicationDate: loans.applicationDate,
      targetCloseDate: loans.targetCloseDate,
      fundedAt: loans.fundedAt,
      closedReason: loans.closedReason,
      createdAt: loans.createdAt,
      loanOfficerId: loans.loanOfficerId,
      uploadToken: loans.uploadToken,
      officerId: officer.id,
      officerName: officer.name,
      officerNmls: officer.nmlsId,
      officerPhone: officer.phone,
      processorId: processor.id,
      processorName: processor.name,
      processorNmls: processor.nmlsId,
      processorPhone: processor.phone,
    })
    .from(loans)
    .innerJoin(officer, eq(officer.id, loans.loanOfficerId))
    .leftJoin(processor, eq(processor.id, loans.processorId))
    .where(and(eq(loans.id, loanId), loanScope(actor, "read")))
    .limit(1);
  if (!row) return null;

  const { uploadToken, ...loan } = row;
  const mayManageLink = can(actor, "loan.manage_link", loan);
  return {
    ...loan,
    familyName: familyName(loan.borrowerName),
    borrowerFirstName:
      loan.borrowerName.trim().split(/\s+/)[0] ?? loan.borrowerName,
    loanOfficer: {
      id: row.officerId,
      name: row.officerName,
      nmlsId: row.officerNmls,
      phone: row.officerPhone,
    },
    processor: row.processorId
      ? {
          id: row.processorId,
          name: row.processorName ?? "",
          nmlsId: row.processorNmls,
          phone: row.processorPhone,
        }
      : null,
    uploadToken: mayManageLink ? uploadToken : null,
  };
}
