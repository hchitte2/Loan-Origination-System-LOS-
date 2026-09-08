import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, loans, user } from "@/db/schema";
import type { LoanType } from "@/lib/loan-facts";
import type { Stage } from "@/lib/stages";
import type { Actor } from "../actor";
import { assertCan } from "../authz";

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
    .where(options.mine ? eq(loans.loanOfficerId, actor.userId) : undefined)
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
