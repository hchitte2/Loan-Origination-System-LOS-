import { cache } from "react";
import { requireActor } from "@/server/actor";
import { getLoanDetail, type LoanDetail } from "@/server/queries/loans";

/**
 * The layout draws the header and every tab draws its own body, so both ask for the same
 * loan in one request. `cache` makes that one query rather than two; the authorization
 * inside `getLoanDetail` still runs on the first call.
 */
export const loadLoan = cache(
  async (loanId: string): Promise<LoanDetail | null> => {
    const actor = await requireActor();
    return getLoanDetail(actor, loanId);
  },
);
