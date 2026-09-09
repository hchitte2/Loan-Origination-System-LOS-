import { BlobNotFoundError, del, get, head, list, put } from "@vercel/blob";
import { getEnv } from "@/lib/env";
import { SEED_PREFIX, UPLOAD_PREFIX, uploadPrefix } from "@/lib/uploads";
import { startOfUtcDay } from "./limits";

/**
 * The one module that talks to Vercel Blob (`.claude/rules/server.md`). Everything else
 * — the upload route, the register actions, the download route, the reset — goes through
 * these helpers, so the store's shape is decided in one place.
 *
 * The pathname rules themselves live in `src/lib/uploads.ts`, because the browser has to
 * apply them too. Two prefixes, and the difference matters:
 *
 * - `uploads/<loanId>/…` — what people send. The nightly reset deletes these by the
 *   pathnames recorded in `documents.blob_pathname`.
 * - `seed/…` — the three specimen PDFs the fixture points at, uploaded once by
 *   `pnpm seed:files`. The reset never touches them, so reseeding costs no uploads.
 *
 * The store is private: nothing here ever hands out a blob URL. Bytes reach a browser
 * only through `/api/files/[documentId]`, which authorizes first.
 */

/**
 * How many objects were written under `uploads/` since midnight UTC, and how many of
 * those belong to one loan.
 *
 * The caps have to be counted here rather than from the `documents` table, because a
 * `documents` row only exists after the browser calls a register action — a separate
 * request, made after the upload has already happened. A caller who takes a token,
 * writes the file and never registers it would increment nothing and could repeat that
 * forever, which is exactly the put budget the caps exist to protect (PLAN.md §4).
 *
 * `list` is a basic Blob operation, not an advanced one, so paying for it on every token
 * request costs nothing against the budget it is defending. `seed/` is outside the
 * prefix, so the specimens never count.
 */
export async function countUploadsToday(
  loanId: string,
  now?: Date,
): Promise<{ forLoan: number; forDay: number }> {
  const since = startOfUtcDay(now);
  const token = getEnv().BLOB_READ_WRITE_TOKEN;
  const prefix = uploadPrefix(loanId);

  let cursor: string | undefined;
  let forLoan = 0;
  let forDay = 0;
  do {
    const page = await list({ prefix: UPLOAD_PREFIX, cursor, token });
    for (const blob of page.blobs) {
      if (blob.uploadedAt < since) continue;
      forDay += 1;
      if (blob.pathname.startsWith(prefix)) forLoan += 1;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return { forLoan, forDay };
}

/** How many pathnames one `del` call may carry. The API allows more; this stays modest. */
const DELETE_BATCH = 100;

/**
 * Delete the given uploaded blobs. Returns how many went.
 *
 * The caller passes the pathnames recorded in `documents.blob_pathname` (PLAN.md §5), not
 * a prefix: a delete is only ever issued for an object the database has a row for. That
 * is the reason to prefer it over a `list({ prefix: "uploads/" })` sweep — the sweep is
 * one unscoped call away from taking anything that happens to be filed under `uploads/`,
 * whereas this cannot delete what it was not told about.
 *
 * `seed/` is refused rather than filtered quietly. Nothing should ever ask, and a caller
 * that did would be a bug worth seeing: those three specimens are what the fixture points
 * at, and losing them means reseeding costs uploads.
 *
 * What this does not clear is an upload that was written but never registered. Those
 * survive the reset and hold storage until someone empties the store by hand. They do not
 * spend the next day's put budget: `countUploadsToday` counts only objects written since
 * midnight UTC, so yesterday's orphans are outside every cap window by the time the
 * nightly reset runs.
 */
export async function purgeUploads(
  pathnames: readonly string[],
): Promise<number> {
  const targets = [...new Set(pathnames)];
  const stray = targets.filter(
    (pathname) => !pathname.startsWith(UPLOAD_PREFIX),
  );
  if (stray.length > 0) {
    throw new Error(
      `Refusing to delete outside ${UPLOAD_PREFIX}: ${stray.join(", ")}`,
    );
  }
  if (targets.length === 0) return 0;

  const token = getEnv().BLOB_READ_WRITE_TOKEN;
  for (let i = 0; i < targets.length; i += DELETE_BATCH) {
    await del(targets.slice(i, i + DELETE_BATCH), { token });
  }
  return targets.length;
}

/**
 * Put one specimen at a fixed `seed/` pathname. Overwrites on purpose and adds no random
 * suffix: the fixture points at these exact pathnames, `pnpm seed:files` is re-runnable,
 * and re-running it must not leave a second copy behind.
 */
export async function putSpecimen(
  pathname: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (!pathname.startsWith(SEED_PREFIX)) {
    throw new Error(`A specimen must live under ${SEED_PREFIX}: ${pathname}`);
  }
  await put(pathname, body, {
    access: "private",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: getEnv().BLOB_READ_WRITE_TOKEN,
  });
}

/**
 * What the store actually holds at this pathname, or null if nothing does.
 *
 * The register actions ask this instead of believing the browser: the client reports a
 * size and a type, but the store is the only thing that knows what was really written.
 * It also proves the upload happened — a `documents` row whose blob does not exist would
 * be a download that 404s later.
 */
export async function statBlob(pathname: string): Promise<{
  contentType: string;
  size: number;
} | null> {
  try {
    const blob = await head(pathname, {
      token: getEnv().BLOB_READ_WRITE_TOKEN,
    });
    return { contentType: blob.contentType, size: blob.size };
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

/**
 * Read one private blob. Returns null when the store has no such pathname, which the
 * download route turns into a 404 — a `documents` row whose blob is gone is a bug worth
 * seeing as a missing file, not a crash.
 */
export async function readBlob(pathname: string): Promise<{
  stream: ReadableStream;
  contentType: string;
  size: number;
} | null> {
  const result = await get(pathname, {
    access: "private",
    token: getEnv().BLOB_READ_WRITE_TOKEN,
  });
  if (!result?.stream || result.blob.contentType === null) return null;
  return {
    stream: result.stream,
    contentType: result.blob.contentType,
    size: result.blob.size,
  };
}
