import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Status pill (design-system skill, "Recipes"): icon + text, 22 px, never colour alone.
 * Semantic tones put the token on a 12 % tint; neutral is muted; stage tones are 22 % of
 * the stage's chart colour with foreground text.
 */
export type PillTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "destructive"
  | "stage-1"
  | "stage-2"
  | "stage-3"
  | "stage-4"
  | "stage-5"
  | "stage-6";

const TONES: Record<PillTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive-soft text-destructive",
  "stage-1": "bg-stage-1 text-foreground",
  "stage-2": "bg-stage-2 text-foreground",
  "stage-3": "bg-stage-3 text-foreground",
  "stage-4": "bg-stage-4 text-foreground",
  "stage-5": "bg-stage-5 text-foreground",
  "stage-6": "bg-stage-6 text-foreground",
};

export function Pill({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: PillTone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-pill shrink-0 items-center gap-1 rounded-lg px-2 text-caption font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
      {children}
    </span>
  );
}
