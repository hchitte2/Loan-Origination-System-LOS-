import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, loans, user } from "@/db/schema";
import type { LoanType } from "@/lib/loan-facts";
import type { Stage } from "@/lib/stages";
import type { Actor } from "../actor";
import { assertCan, loanScope } from "../authz";

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
    // Oldest in stage first, so the files that have stopped moving sit at the top of
    // their column. The design frames show the fixture's declaration order, which no
    // query can reproduce from the data.
    .orderBy(asc(loans.stageEnteredAt), asc(loans.id));

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
