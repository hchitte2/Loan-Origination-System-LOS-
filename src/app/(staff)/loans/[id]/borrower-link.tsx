"use client";

import { Check, Copy, Link2, RefreshCw } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  logLinkCopied,
  type RegenerateLinkState,
  regenerateLink,
} from "@/server/actions/loans";

/**
 * The borrower's link (design frame 03-loan-overview). Copy puts it on the clipboard;
 * regenerating issues a new one and revokes the old immediately, so it goes through the
 * confirm rather than a bare button.
 *
 * The absolute URL is built in the browser from `window.location.origin`, so the same
 * loan gives the right link on localhost, on a preview and in production without the
 * origin being an environment variable the server has to know.
 */
export function BorrowerLink({
  loanId,
  firstName,
  token,
}: {
  loanId: string;
  firstName: string;
  token: string;
}) {
  const path = `/u/${token}`;
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const [state, formAction] = useActionState<RegenerateLinkState, FormData>(
    async (previous, formData) => {
      const result = await regenerateLink(previous, formData);
      if (result?.ok) {
        setConfirming(false);
        setCopied(false);
        toast.success(
          `New link issued. ${firstName}'s old link no longer works.`,
        );
        return null;
      }
      return result;
    },
    null,
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${origin}${path}`);
      setCopied(true);
      toast.success(`${firstName}'s link copied.`);
      // Fire and forget. The copy has already happened; a log that will not write must
      // not turn it into an error the person has to read.
      void logLinkCopied(loanId).catch(() => {});
    } catch {
      toast.error(
        "Your browser would not let us copy. Select the link instead.",
      );
    }
  };

  return (
    <Card title="Borrower link">
      <p className="text-body text-muted-foreground">
        {firstName} opens this link on their phone to see what is needed and
        upload documents. No login.
      </p>
      <p className="flex items-center gap-2 overflow-hidden rounded-lg bg-muted px-3 py-2 font-mono text-caption text-muted-foreground">
        <Link2 aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{origin ? `${origin}${path}` : path}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : `Copy ${firstName}'s link`}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirming(true)}
        >
          <RefreshCw aria-hidden="true" />
          Regenerate link
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">
        Regenerating revokes the old link immediately.
      </p>

      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirming(false);
          }}
          title={`Regenerate ${firstName}'s link?`}
          description={`The link ${firstName} has stops working straight away. Anyone holding the old one, including ${firstName}, will need the new link.`}
          cancelLabel="Keep the current link"
          confirmLabel="Regenerate link"
          pendingLabel="Regenerating…"
          action={formAction}
          fields={{ loanId }}
          error={state && !state.ok ? state.error : undefined}
        />
      ) : null}
    </Card>
  );
}
