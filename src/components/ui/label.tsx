"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

/** Every label names its control: `htmlFor` is required, not optional. */
function Label({
  className,
  htmlFor,
  ...props
}: React.ComponentProps<"label"> & { htmlFor: string }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the wrapper forwards a required htmlFor to the native label
    <label
      data-slot="label"
      htmlFor={htmlFor}
      className={cn(
        "flex items-center gap-2 text-body font-medium text-foreground select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
