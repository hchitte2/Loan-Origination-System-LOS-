"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

/** The banner's Exit button: outlined in the banner's dark text, pending as "Exiting…". */
export function ExitViewButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-banner-foreground/60 bg-transparent px-3 text-control text-banner-foreground transition-colors duration-150 ease-out hover:bg-banner-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-banner-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-banner disabled:opacity-70 motion-reduce:transition-none"
    >
      {pending ? (
        <>
          <Loader2
            aria-hidden="true"
            className="size-4 animate-spin motion-reduce:animate-none"
          />
          Exiting…
        </>
      ) : (
        "Exit view"
      )}
    </button>
  );
}
