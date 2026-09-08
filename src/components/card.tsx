import { cn } from "@/lib/utils";

/**
 * A titled panel on the `card` surface (design frame 03-loan-overview): 16 px padding,
 * the section title left and at most one action right. Shared so the Overview cards and
 * the borrower-link card cannot drift apart.
 */
export function Card({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
