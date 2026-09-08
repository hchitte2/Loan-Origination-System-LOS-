"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

/** Plain sentence and a retry; the details stay in the server log. */
export default function StaffError({ reset }: { reset: () => void }) {
  return (
    <>
      <PageHeader title="Something went wrong" />
      <div className="px-6 pb-6">
        <EmptyState
          icon={TriangleAlert}
          title="Something went wrong on our side."
          description="Nothing you did caused it. Try again, and if it keeps happening the demo may be mid-reset."
          action={
            <Button variant="outline" onClick={() => reset()}>
              <RotateCcw aria-hidden="true" />
              Try again
            </Button>
          }
        />
      </div>
    </>
  );
}
