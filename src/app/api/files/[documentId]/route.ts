import { getActor } from "@/server/actor";
import { can } from "@/server/authz";
import { getDocumentForDownload } from "@/server/queries/documents";
import { readBlob } from "@/server/storage";

/**
 * The only way bytes leave the private Blob store (PLAN.md §5 "File storage").
 *
 * The store hands out no public URLs, so a document is reachable only through this
 * route, and only with a staff session: `getActor()` rather than `requireActor()`,
 * because a fetch for a file should get 401, not a redirect to a login page it cannot
 * render. The borrower's page shows status, never bytes — it never links here.
 *
 * `Cache-Control: private, no-store` keeps a shared proxy or a browser cache from
 * holding someone else's document after they sign out.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/files/[documentId]">,
): Promise<Response> {
  const actor = await getActor();
  if (!actor) {
    return new Response("Sign in to download documents.", {
      status: 401,
      headers: { "cache-control": "private, no-store" },
    });
  }
  if (!can(actor, "document.download")) {
    return new Response("Your role does not download documents.", {
      status: 403,
      headers: { "cache-control": "private, no-store" },
    });
  }

  const { documentId } = await ctx.params;
  const document = await getDocumentForDownload(actor, documentId);
  // Missing and not-visible are the same answer, so ids cannot be probed.
  if (!document) {
    return new Response("Not found.", {
      status: 404,
      headers: { "cache-control": "private, no-store" },
    });
  }

  const blob = await readBlob(document.blobPathname);
  if (!blob) {
    // The row exists but the object is gone — a reset that ran between the two, or a
    // bug. Either way there is nothing to send, and the reviewer should see a plain 404.
    return new Response("That file is no longer stored.", {
      status: 404,
      headers: { "cache-control": "private, no-store" },
    });
  }

  return new Response(blob.stream, {
    headers: {
      "content-type": blob.contentType,
      "content-length": String(blob.size),
      // `inline` so a PDF opens in the browser's viewer, which is how a reviewer reads
      // one. The file name is already sanitised on the way in; it is quoted here so a
      // space or a comma cannot end the header value early.
      "content-disposition": `inline; filename="${document.fileName.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
      // The store is private and the bytes are user-supplied: never let a browser
      // re-interpret a PDF as something scriptable.
      "x-content-type-options": "nosniff",
    },
  });
}
