import { eq } from "drizzle-orm";
import { db } from "@/db";
import { loans } from "@/db/schema";
import { isTerminalStage, type Stage } from "@/lib/stages";

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
