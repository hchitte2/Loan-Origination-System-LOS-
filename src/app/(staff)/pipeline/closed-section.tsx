"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * "Closed · 2" (design frame 02-pipeline-list): the funded, withdrawn and denied files,
 * folded away under the live pipeline so they stay reachable without competing with it.
 * The rows are rendered on the server and passed in; only the disclosure is client state.
 */
export function ClosedSection({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col">
      {/* `contents` keeps the heading in the outline without adding a box. */}
      <h2 className="contents">
        <CollapsibleTrigger className="inline-flex h-8 w-fit items-center gap-2 rounded-lg px-1 text-control text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 transition-transform duration-150 ease-out motion-reduce:transition-none",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
          <span className="font-semibold">Closed</span>
          <span className="text-muted-foreground tabular-nums">
            · {count}
            <span className="sr-only"> closed loans</span>
          </span>
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
