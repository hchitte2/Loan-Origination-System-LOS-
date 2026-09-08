import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Designed empty state: dashed box, 20 px icon, one plain sentence, one line of guidance
 * or one action. Every screen writes its own words; there is no generic "No data".
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
      <p className="text-body font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-body text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
