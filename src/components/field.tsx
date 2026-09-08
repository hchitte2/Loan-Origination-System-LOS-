import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "./ui/label";

/**
 * One labelled form control with its hint or its error (design frame 02-new-loan): the
 * error replaces the hint rather than stacking under it, and carries `<id>-error` so the
 * control can point at it with `aria-describedby`.
 *
 * The label carries `<id>-label` too, for the rare control — the date picker's button —
 * that must name itself with its label *and* its value.
 */
export function Field({
  id,
  label,
  error,
  hint,
  hintId,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  hintId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-start gap-1 text-caption text-destructive"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
