import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getActor } from "@/server/actor";
import { can } from "@/server/authz";
import {
  ALLOWED_CONTENT_TYPES,
  CAP_REACHED,
  countUploadsToday,
  MAX_FILE_BYTES,
  uploadCapReached,
} from "@/server/limits";
import { getLoanForAction } from "@/server/queries/loans";
import { resolveUploadToken } from "@/server/queries/public";
import { isInLoanPrefix } from "@/server/storage";

/**
 * The client-upload token endpoint (PLAN.md §5 "File storage").
 *
 * The browser asks here before it may write a byte. This decides *whether* and *where*:
 * who is asking, which loan they may write into, that the pathname is inside that loan's
 * folder, that the type and size are allowed, and that the day's caps are not spent.
 * Only then does Blob issue a token, scoped to those limits.
 *
 * Two callers, one door:
 *
 * - Staff, with a session: `clientPayload` names the loan, and `can(document.upload)`
 *   decides — which also refuses a terminal loan (PLAN.md §6 invariant 8).
 * - A borrower, with no session: `clientPayload` carries the upload token, which is the
 *   whole of the authorization and resolves to exactly one live, non-terminal loan.
 *
 * `onUploadCompleted` is deliberately absent: it never fires on localhost, so the demo
 * would work in production and silently lose documents in development. The browser calls
 * `registerDocument` / `registerPublicDocument` after `upload()` resolves instead, and
 * those re-check everything decided here.
 */

const PayloadSchema = z.union([
  z.object({ loanId: z.uuid() }),
  z.object({ token: z.string().min(16).max(64) }),
]);

/** A refusal the caller should see, with the status it deserves. Bugs still throw. */
class UploadRefusal extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "UploadRefusal";
    this.status = status;
  }
}

/**
 * Which loan this upload may write into, or a refusal. Returns only the loan id: the
 * token endpoint has no reason to know anything else about the file.
 */
async function authorizeUpload(
  pathname: string,
  clientPayload: string | null,
): Promise<string> {
  if (!clientPayload) {
    throw new UploadRefusal(400, "That upload did not say where it belongs.");
  }
  let parsed: z.infer<typeof PayloadSchema>;
  try {
    parsed = PayloadSchema.parse(JSON.parse(clientPayload));
  } catch {
    throw new UploadRefusal(400, "That upload did not say where it belongs.");
  }

  const loanId =
    "token" in parsed
      ? ((await resolveUploadToken(parsed.token))?.id ?? null)
      : await staffLoanId(parsed.loanId);
  if (!loanId) {
    // One message for an unknown token, a revoked link and a closed loan: a caller
    // holding a bad token must not learn which of the three it is.
    throw new UploadRefusal(403, "This link is no longer active.");
  }

  // The browser proposes the pathname, so this is the check that keeps one loan's token
  // from writing into another's folder.
  if (!isInLoanPrefix(pathname, loanId)) {
    throw new UploadRefusal(403, "That file cannot be stored there.");
  }

  if (uploadCapReached(await countUploadsToday(loanId))) {
    throw new UploadRefusal(429, CAP_REACHED);
  }
  return loanId;
}

/** The staff path: a session, and the matrix row for uploading to this loan. */
async function staffLoanId(loanId: string): Promise<string | null> {
  const actor = await getActor();
  if (!actor) throw new UploadRefusal(401, "Sign in to upload documents.");
  const loan = await getLoanForAction(actor, loanId);
  if (!loan) return null;
  return can(actor, "document.upload", loan) ? loan.id : null;
}

export async function POST(request: Request): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      token: getEnv().BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const loanId = await authorizeUpload(pathname, clientPayload);
        return {
          allowedContentTypes: [...ALLOWED_CONTENT_TYPES],
          maximumSizeInBytes: MAX_FILE_BYTES,
          // Two "w2.pdf" uploads on one loan must both survive; blob_pathname is unique.
          addRandomSuffix: true,
          // Carried back on the completion callback only. The register actions re-derive
          // everything from the session or the token, so nothing here is trusted later.
          tokenPayload: JSON.stringify({ loanId }),
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof UploadRefusal) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
