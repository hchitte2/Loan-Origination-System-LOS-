import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * shadcn Textarea restyled through Clearline tokens, matching `Input` exactly apart from
 * being multi-line: same border, surface, body type and focus-ring recipe, and the same
 * border-plus-ring invalid state. It resizes vertically only, so dragging the grip cannot
 * push it past a 560 px dialog.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-body text-foreground transition-colors outline-none motion-reduce:transition-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
