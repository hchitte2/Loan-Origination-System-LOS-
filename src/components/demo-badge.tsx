import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** "Demo · synthetic data": dashed border, 24 px, 11 px 500, `info` icon. Part of both shells. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-lg border border-dashed border-border bg-card px-2 text-tag text-muted-foreground",
        className,
      )}
    >
      <Info aria-hidden="true" className="size-3.5" />
      Demo · synthetic data
    </span>
  );
}
