import { like } from "drizzle-orm";
import { type Db, db } from "@/db";
import { documents } from "@/db/schema";
import { type SeedSummary, seedFixture } from "@/db/seed";
import { getEnv } from "@/lib/env";
import { UPLOAD_PREFIX } from "@/lib/uploads";
import { purgeUploads } from "./storage";

/**
 * Put the demo back to the fixture (PLAN.md §5 "Demo reset").
 *
 * Three callers share this: the nightly cron route, the superadmin's "Reset demo data"
 * button, and `pnpm db:reset` on the command line. Keeping the order in one place is the
 * point — the sequence below is not arbitrary.
 *
 * 1. Read the uploaded pathnames out of `documents`.
 * 2. Delete those blobs.
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
};

export async function resetDemo(
  options: { now?: Date; database?: Db } = {},
): Promise<ResetSummary> {
  const now = options.now ?? new Date();
  const database = options.database ?? db();
  // Validates the whole environment before anything is destroyed: a reset that truncates
  // and then finds DEMO_PASSWORD missing would leave the demo empty.
  const env = getEnv();

  const uploaded = await database
    .select({ pathname: documents.blobPathname })
    .from(documents)
    .where(like(documents.blobPathname, `${UPLOAD_PREFIX}%`));

  const blobsDeleted = await purgeUploads(uploaded.map((row) => row.pathname));

  const summary = await seedFixture(database, {
    now,
    demoPassword: env.DEMO_PASSWORD,
    showcaseToken: env.DEMO_SHOWCASE_TOKEN,
    mode: "reset",
  });

  return { ...summary, blobsDeleted };
}
