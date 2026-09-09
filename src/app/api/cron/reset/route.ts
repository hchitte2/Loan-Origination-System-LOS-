import { timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import { resetDemo } from "@/server/reset";

/**
 * The nightly reset (PLAN.md §5 "Demo reset"; `vercel.json` runs it at 08:00 UTC).
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`, so that is the whole of the
 * authorization — there is no actor and no session. It is checked before anything else
 * happens, and a wrong or absent secret gets 401 with no detail: this endpoint is
 * reachable from the open internet and must not describe itself to a prober.
 *
 * The work itself is `resetDemo`, shared with `pnpm db:reset` and the superadmin button,
 * and idempotent — running it twice leaves the same fixture.
 */

export const dynamic = "force-dynamic";
/** The reset truncates, reseeds and hashes six passwords; 60 s is the Hobby ceiling. */
export const maxDuration = 60;

/** Constant-time compare that does not leak the secret's length through an early return. */
function secretMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  const header = request.headers.get("authorization") ?? "";
  if (!secretMatches(header, `Bearer ${getEnv().CRON_SECRET}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const startedAt = Date.now();
  const summary = await resetDemo();
  return Response.json({
    ok: true,
    ms: Date.now() - startedAt,
    blobsDeleted: summary.blobsDeleted,
    users: summary.users,
    loans: summary.loans,
    conditions: summary.conditions,
    documents: summary.documents,
    activity: summary.activity,
  });
}
