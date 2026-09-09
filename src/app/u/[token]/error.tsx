"use client";

import { Button } from "@/components/ui/button";

/**
 * Something broke while loading the borrower's page. No stack trace and no jargon: they
 * did nothing wrong, and the only useful action is to try again or call the person whose
 * number is in the bar above.
 */
export default function PublicLoanError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center shadow-card">
      <h1 className="text-greeting text-foreground">
        We couldn't load your loan just now.
      </h1>
      <p className="text-public text-muted-foreground">
        Try again in a moment. If it keeps happening, call your loan officer.
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
