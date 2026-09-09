import { like } from "drizzle-orm";
import { type Db, db } from "@/db";
import { documents } from "@/db/schema";
import { type SeedSummary, seedFixture } from "@/db/seed";
import { getEnv } from "@/lib/env";
import { UPLOAD_PREFIX } from "@/lib/uploads";
import type { Actor } from "./actor";
import { startOfUtcDay } from "./limits";
import { purgeOrphanedUploads, purgeUploads } from "./storage";

/**
 * Put the demo back to the fixture (PLAN.md §5 "Demo reset").
 *
 * Three callers share this: the nightly cron route, the superadmin's "Reset demo data"
 * button, and `pnpm db:reset` on the command line. Keeping the order in one place is the
 * point — the sequence below is not arbitrary.
 *
 * 1. Read the uploaded pathnames out of `documents`.
 * 2. Delete those blobs, then sweep any from a previous day that no row ever named.
 * 3. Truncate and reseed relative to `now`, which writes the `demo.reset` activity row.
 *
 * Blobs go first because the reseed truncates `documents`. If the delete fails halfway,
 * the rows are still there and the next run picks up what this one missed; doing it the
 * other way round would orphan every remaining object with no record of its pathname.
 *
 * Idempotent by construction: step 1 finds nothing on a second run (the fixture's own
 * documents point at `seed/`), and `seedFixture` truncates before it inserts, so running
 * this twice leaves exactly the state running it once does.
 */

export type ResetSummary = SeedSummary & {
  /** Uploaded blobs deleted. Zero on a demo nobody has uploaded to since the last reset. */
  blobsDeleted: number;
  /** Blobs with no `documents` row, from a previous day. Normally zero. */
  orphansDeleted: number;
};

export async function resetDemo(
  options: { now?: Date; database?: Db; actor?: Actor } = {},
): Promise<ResetSummary> {
  const now = options.now ?? new Date();
  const database = options.database ?? db();
  const { actor } = options;
  // Validates the whole environment before anything is destroyed: a reset that truncates
  // and then finds DEMO_PASSWORD missing would leave the demo empty.
  const env = getEnv();

  const uploaded = await database
    .select({ pathname: documents.blobPathname })
    .from(documents)
    .where(like(documents.blobPathname, `${UPLOAD_PREFIX}%`));

  const pathnames = uploaded.map((row) => row.pathname);
  const blobsDeleted = await purgeUploads(pathnames);
  // What the rows never knew about: uploads written but never registered. Bounded to
  // objects from a previous UTC day, so an upload in flight right now is never touched.
  const orphansDeleted = await purgeOrphanedUploads(
    startOfUtcDay(now),
    new Set(pathnames),
  );

  const summary = await seedFixture(database, {
    now,
    demoPassword: env.DEMO_PASSWORD,
    showcaseToken: env.DEMO_SHOWCASE_TOKEN,
    mode: "reset",
    // The nightly cron passes no actor and the row stays a system event. The
    // impersonation branch is defensive rather than reachable: `admin.reset_demo` is
    // false for both non-superadmin roles and `assertCan` runs against the effective
    // user, so nobody can reset the demo while viewing as someone else.
    resetBy: actor
      ? {
          actorId: actor.actorUserId,
          onBehalfOf: actor.impersonating ? actor.userId : null,
        }
      : undefined,
  });

  return { ...summary, blobsDeleted, orphansDeleted };
}
