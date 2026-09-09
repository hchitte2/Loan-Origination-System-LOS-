/**
 * The upload rules that both sides need (PLAN.md §5 "File storage" and "Abuse controls").
 *
 * They live in `lib` rather than in `server/limits.ts` or `server/storage.ts` because the
 * browser has to apply them too: `UploadZone` proposes the pathname and refuses an
 * oversized or wrong-typed file before starting a doomed upload. Importing a server
 * module to get them would pull Drizzle and the database client into the client bundle.
 *
 * Nothing here is a control. Blob refuses the same size and type by token, and the
 * register actions refuse them again from what the store actually holds; the counted caps
 * and every storage call stay in `src/server`, where they cannot be bypassed.
 */

/** One file. Also handed to Blob as `maximumSizeInBytes`, so the browser refuses early. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * The three types a mortgage file actually arrives as. Anything executable, archived or
 * scriptable is absent on purpose: this store is read back by people, not by a sandbox.
 */
export const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export function isAllowedContentType(
  contentType: string,
): contentType is AllowedContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType);
}

/**
 * Why a file was refused, or null when it is fine. The type is checked before the size,
 * so an .exe is never called "too large".
 *
 * Two parts, because the upload zone draws them as two lines — what happened, then what
 * to do about it (design-system skill, "Upload zone"). A server action, which has one
 * string to return, joins them with `rejectionSentence`.
 */
export type FileRejection = { title: string; hint: string };

export function fileRejection(
  contentType: string,
  sizeBytes: number,
): FileRejection | null {
  if (!isAllowedContentType(contentType)) {
    return {
      title: "That kind of file will not open on our side",
      hint: "Send a PDF, JPG or PNG.",
    };
  }
  if (sizeBytes > MAX_FILE_BYTES) {
    return {
      title: "That file is too large",
      hint: `Keep it under ${MAX_FILE_BYTES / 1024 / 1024} MB and try again.`,
    };
  }
  if (sizeBytes <= 0) {
    return {
      title: "That file came through empty",
      hint: "Try sending it again.",
    };
  }
  return null;
}

export function rejectionSentence(rejection: FileRejection): string {
  return `${rejection.title}. ${rejection.hint}`;
}

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
