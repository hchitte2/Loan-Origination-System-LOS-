import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The 20 px tag (design-system skill, "Sizes and spacing"): smaller and quieter than a
 * `Pill`, which is reserved for status. Outlined carries a fact — the loan program on a
 * card, the prior-to bucket on a condition. The tinted tones carry attention, and always
 * with an icon so the tag never speaks through colour alone.
 */
export type TagTone = "outline" | "warning" | "destructive";

const TONES: Record<TagTone, string> = {
  outline: "border border-border text-muted-foreground",
  warning: "bg-warning-soft text-warning-on-soft",
  destructive: "bg-destructive-soft text-destructive",
};

export function Tag({
  tone = "outline",
  icon: Icon,
  children,
  className,
}: {
  tone?: TagTone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-tag shrink-0 items-center gap-1 rounded-lg px-1.5 text-tag whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
      {children}
    </span>
  );
}
