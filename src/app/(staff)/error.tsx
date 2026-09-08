"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Plain sentence and a retry; the details stay in the server log. */
export default function StaffError({ reset }: { reset: () => void }) {
  return (
    <div className="px-6 py-6">
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6">
        <TriangleAlert aria-hidden="true" className="size-5 text-destructive" />
        <p className="text-body font-medium text-foreground">
          Something went wrong on our side.
        </p>
        <p className="text-body text-muted-foreground">
          Nothing you did caused it. Try again, and if it keeps happening the
          demo may be mid-reset.
        </p>
        <Button variant="outline" onClick={() => reset()}>
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
      </div>
    </div>
  );
}
