"use client";

import { Loader } from "lucide-react";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./ui/button";

/**
 * A form's submit button with the design's pending state: a spinning `loader` (static
 * under reduced motion) and an "…ing" label supplied by the caller.
 */
export function SubmitButton({
  pendingLabel,
  children,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Loader
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
