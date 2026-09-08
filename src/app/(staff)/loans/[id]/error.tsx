"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Scoped to the loan's tabs, so a failed query loses the body and not the header: the
 * file's name, its stage and the way back all stay on screen.
 */
export default function LoanDetailError({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="This part of the loan would not load."
      description="The rest of the file is fine. Try again, and if it keeps happening the demo may be mid-reset."
      action={
        <Button variant="outline" onClick={() => reset()}>
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
      }
    />
  );
}
