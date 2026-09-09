import { Link2Off } from "lucide-react";

/**
 * The dead-link card (design frame 05-public-expired). One page for every reason a token
 * fails — unknown, revoked, or a loan that has closed — because the borrower cannot act
 * on the difference and a stranger must not learn it.
 *
 * There is no loan to read a phone number from, so the only way forward is the sentence
 * itself: ask whoever sent the link for a new one.
 */
export default function PublicLinkNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center shadow-card">
      <Link2Off aria-hidden="true" className="size-6 text-muted-foreground" />
      <h1 className="text-greeting text-foreground">
        This link is no longer active.
      </h1>
      <p className="text-public text-muted-foreground">
        Ask your loan officer for a new one.
      </p>
    </div>
  );
}
