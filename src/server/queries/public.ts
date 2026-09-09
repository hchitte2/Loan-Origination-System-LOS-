import { and, asc, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { conditions, documents, loans, user } from "@/db/schema";
import {
  type ConditionStatus,
  OPEN_CONDITION_STATUSES,
} from "@/lib/conditions";
import { isTerminalStage, type Stage } from "@/lib/stages";
import { type PublicLoanView, redactForPublic } from "../authz";

/**
 * Reads for the borrower's page (`/u/[token]`). There is no session here, so the token
 * is the whole of the authorization: every function starts from it, and nothing on this
 * route accepts a loan id (`.claude/rules/public.md`).
 */

/** What a live token resolves to. Never leaves this module without being redacted. */
export type PublicLoanRef = {
  id: string;
  stage: Stage;
};

/**
 * The loan a token opens, or null. Null covers every reason equally — unknown token,
 * revoked link, closed loan — because the page shows one designed "no longer active"
 * card for all of them and the caller should not be able to tell them apart.
 *
 * A terminal loan refuses here rather than in the caller: a funded file's link is dead,
 * and PLAN.md §6 invariant 5 puts public uploads on non-terminal loans only.
 */
export async function resolveUploadToken(
  token: string,
): Promise<PublicLoanRef | null> {
  // Tokens are 32 URL-safe characters. Anything else is not worth a query.
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [row] = await db()
    .select({
      id: loans.id,
      stage: loans.stage,
      revokedAt: loans.uploadTokenRevokedAt,
    })
    .from(loans)
    .where(eq(loans.uploadToken, token))
    .limit(1);
  if (!row) return null;
  if (row.revokedAt !== null) return null;
  if (isTerminalStage(row.stage)) return null;
  return { id: row.id, stage: row.stage };
}

/** The slice of a condition a public upload needs to decide what it may answer. */
export type PublicCondition = {
  id: string;
  title: string;
  status: ConditionStatus;
};

/**
 * A condition the borrower may upload against: on this loan, borrower-facing (PLAN.md §6
 * invariant 5), and still open.
 *
 * All three are checked here rather than in the component, because the register action is
 * a Server Action and accepts a direct POST — the page not drawing an upload box on a
 * cleared item is presentation, not protection. An internal or settled condition returns
 * null exactly as a foreign id does, so a token holder cannot tell them apart.
 */
export async function getPublicCondition(
  loanId: string,
  conditionId: string,
): Promise<PublicCondition | null> {
  const [row] = await db()
    .select({
      id: conditions.id,
      title: conditions.title,
      status: conditions.status,
    })
    .from(conditions)
    .where(
      and(
        eq(conditions.id, conditionId),
        eq(conditions.loanId, loanId),
        eq(conditions.borrowerFacing, true),
        inArray(conditions.status, [...OPEN_CONDITION_STATUSES]),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Everything `/u/[token]` renders, or null when the link is dead.
 *
 * Wrapped in `cache()` because both the layout (for the loan officer's line) and the page
 * ask for it: one render, one set of queries rather than two.
 *
 * The page calls only this. It loads the rows and hands them straight to
 * `redactForPublic`, so nothing outside `PublicLoanView` is ever in scope to leak into
 * the serialised payload — the rule in `.claude/rules/public.md` that a Server Component
 * serialises what it fetches, not what it draws.
 */
export const getPublicLoanView = cache(
  async (token: string): Promise<PublicLoanView | null> => {
    const ref = await resolveUploadToken(token);
    if (!ref) return null;

    const [row] = await db()
      .select({
        id: loans.id,
        borrowerName: loans.borrowerName,
        propertyStreet: loans.propertyStreet,
        propertyCity: loans.propertyCity,
        propertyState: loans.propertyState,
        amount: loans.amount,
        purpose: loans.purpose,
        loanType: loans.loanType,
        stage: loans.stage,
        targetCloseDate: loans.targetCloseDate,
        officerName: user.name,
        officerPhone: user.phone,
      })
      .from(loans)
      .innerJoin(user, eq(user.id, loans.loanOfficerId))
      .where(eq(loans.id, ref.id))
      .limit(1);
    if (!row) return null;

    const [conditionRows, documentRows] = await Promise.all([
      db()
        .select({
          id: conditions.id,
          title: conditions.title,
          instructions: conditions.instructions,
          status: conditions.status,
          borrowerFacing: conditions.borrowerFacing,
          lastRejectionReason: conditions.lastRejectionReason,
        })
        .from(conditions)
        .where(eq(conditions.loanId, ref.id))
        .orderBy(asc(conditions.createdAt)),
      db()
        .select({
          conditionId: documents.conditionId,
          fileName: documents.fileName,
          createdAt: documents.createdAt,
          uploadedVia: documents.uploadedVia,
        })
        .from(documents)
        .where(eq(documents.loanId, ref.id))
        .orderBy(asc(documents.createdAt)),
    ]);

    const { officerName, officerPhone, ...loan } = row;
    return redactForPublic({
      loan,
      loanOfficer: { name: officerName, phone: officerPhone },
      conditions: conditionRows,
      documents: documentRows,
    });
  },
);
