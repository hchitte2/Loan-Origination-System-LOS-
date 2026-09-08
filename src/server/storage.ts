import { BlobNotFoundError, get, head, put } from "@vercel/blob";
import { getEnv } from "@/lib/env";

/**
 * The one module that talks to Vercel Blob (`.claude/rules/server.md`). Everything else
 * — the upload route, the register actions, the download route, the reset — goes through
 * these helpers, so the store's shape is decided in one place.
 *
 * Two prefixes, and the difference matters:
 *
 * - `uploads/<loanId>/…` — what people send. The nightly reset deletes these by the
 *   pathnames recorded in `documents.blob_pathname`.
 * - `seed/…` — the three specimen PDFs the fixture points at, uploaded once by
 *   `pnpm seed:files`. The reset never touches them, so reseeding costs no uploads.
 *
 * The store is private: nothing here ever hands out a blob URL. Bytes reach a browser
 * only through `/api/files/[documentId]`, which authorizes first.
 */

/** Where the fixture's specimen documents live. Never deleted by a reset. */
export const SEED_PREFIX = "seed/";

/** Everything one loan's uploads share. The upload route pins the token to this. */
export function uploadPrefix(loanId: string): string {
  return `uploads/${loanId}/`;
}

/**
 * Is this pathname inside the loan's own folder?
 *
 * The browser proposes the pathname, so it is attacker-controlled: this is what stops a
 * token issued for one loan writing into another's folder, or climbing out of `uploads/`
 * altogether. Traversal segments are refused outright rather than normalised, because a
 * legitimate upload never contains one and Blob treats the pathname as opaque.
 */
export function isInLoanPrefix(pathname: string, loanId: string): boolean {
  if (pathname.includes("..") || pathname.includes("//")) return false;
  const prefix = uploadPrefix(loanId);
  if (!pathname.startsWith(prefix)) return false;
  // Something has to follow the prefix, and it must be a single file, not a subtree:
  // the reset deletes recorded pathnames, so nothing may hide below one.
  const rest = pathname.slice(prefix.length);
  return rest.length > 0 && !rest.includes("/");
}

/**
 * The pathname a client should ask for. The file name is sanitised here rather than
 * trusted: it reaches the store, the download route's `Content-Disposition` and the
 * needs list. `addRandomSuffix` on the token keeps two "w2.pdf" uploads apart, so this
 * does not need to be unique — only safe and recognisable.
 */
export function blobPathnameFor(loanId: string, fileName: string): string {
  return `${uploadPrefix(loanId)}${safeFileName(fileName)}`;
}

/**
 * A file name reduced to what is safe in a pathname and a header: no separators, no
 * control characters, no leading dot, and short enough to stay readable in the UI.
 */
export function safeFileName(fileName: string): string {
  const cleaned = fileName
    .replace(/[/\\]/g, "-")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point — a newline in a file name would split the Content-Disposition header.
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/^\.+/, "")
    .trim();
  const name = cleaned.length > 0 ? cleaned : "document";
  return name.length > 120 ? name.slice(-120) : name;
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
