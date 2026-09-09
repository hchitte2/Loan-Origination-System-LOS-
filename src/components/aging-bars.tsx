import { cn } from "@/lib/utils";

/**
 * Conditions by age (design frames 04-queue and 06-dashboard): four horizontal bars,
 * greener when young and redder when old, with the count beside each.
 *
 * The bars are decoration — the label and the number carry the meaning — so the list
 * reads correctly with no colour at all.
 */
const TONES = ["bg-chart-2", "bg-chart-4", "bg-warning", "bg-destructive"];

/**
 * Two weights, because the card sits at two levels. On the Queue (04-queue) it is one of
 * four tiles and its title is a tile label; on the Dashboard (06-dashboard) it is a
 * section beside the stage chart and its title matches "Needs attention" below it.
 */
export function AgingBars({
  buckets,
  className,
  variant = "tile",
}: {
  buckets: { label: string; count: number }[];
  className?: string;
  variant?: "tile" | "card";
}) {
  const largest = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-card",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={
            variant === "card"
              ? "text-section text-foreground"
              : "text-control font-normal text-muted-foreground"
          }
        >
          Conditions aging
        </span>
        <span className="text-caption text-muted-foreground tabular-nums">
          {total} open{variant === "card" ? " conditions" : null}
        </span>
      </div>
      <dl className="mt-1 flex flex-1 flex-col justify-center gap-3">
        {buckets.map((bucket, index) => (
          <div key={bucket.label} className="flex items-center gap-2">
            <dt className="w-14 shrink-0 text-caption text-muted-foreground tabular-nums">
              {bucket.label}
            </dt>
            <div
              aria-hidden="true"
              className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn("h-full rounded-full", TONES[index])}
                style={{ width: `${(bucket.count / largest) * 100}%` }}
              />
            </div>
            <dd className="w-6 shrink-0 text-right text-caption text-foreground tabular-nums">
              {bucket.count}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
