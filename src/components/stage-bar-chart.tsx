"use client";

import { Kanban } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { staffLabel } from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { StageSlice } from "@/server/queries/analytics";
import { EmptyState } from "./empty-state";
import { Skeleton } from "./ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

/**
 * Loans per stage (design frames 06-dashboard and 06-dashboard-lo): six bars down the
 * funnel, the count above each and the stage under it, dollars in the tooltip.
 *
 * Every bar is a disclosure button carrying the whole data point in its label — the same
 * pattern `KpiTile` uses for its definition — so a keyboard reaches the dollars a mouse
 * gets from hovering. The button is the whole column, not the coloured rectangle: an
 * empty stage draws a 2 px hairline, and a 2 px tab stop is not a target anyone can hit
 * (WCAG 2.2 AA 2.5.8). The bar inside is `aria-hidden`, so the label is read once.
 *
 * A stage with nothing in it keeps its column. An empty column is a fact about the
 * pipeline — "nothing is in underwriting" — and dropping it would quietly change the
 * shape of the funnel.
 */
const BAR_TONES = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
];

/** One sentence with every number in it, for a reader that does not tab through the bars. */
function summarySentence(slices: StageSlice[], total: number, amount: number) {
  const parts = slices.map(
    (slice) => `${staffLabel(slice.stage)} ${slice.count}`,
  );
  return `${total} ${total === 1 ? "loan" : "loans"}, ${formatMoney(amount)}: ${parts.join(", ")}.`;
}

export function StageBarChart({
  title,
  slices,
}: {
  title: string;
  slices: StageSlice[];
}) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const totalAmount = slices.reduce((sum, slice) => sum + slice.amount, 0);
  const largest = Math.max(1, ...slices.map((slice) => slice.count));

  return (
    <figure className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <figcaption className="text-section text-foreground">
          {title}
        </figcaption>
        <span className="text-caption text-muted-foreground tabular-nums">
          {total} {total === 1 ? "loan" : "loans"}
          {total > 0 ? ` · ${formatMoney(totalAmount)}` : null}
        </span>
      </div>

      {total === 0 ? (
        <EmptyState
          className="mt-2 py-8"
          icon={Kanban}
          title="No active loans yet."
          description="Create a loan from the Pipeline and it shows up here by stage."
        />
      ) : (
        <div className="mt-3">
          <p className="sr-only">
            {summarySentence(slices, total, totalAmount)}
          </p>
          <div className="grid grid-cols-6 gap-2">
            {slices.map((slice, index) => (
              <div key={slice.stage} className="flex h-44 flex-col gap-1.5">
                <span className="text-center text-caption text-foreground tabular-nums">
                  {slice.count}
                </span>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    aria-label={`${staffLabel(slice.stage)}: ${slice.count} ${
                      slice.count === 1 ? "loan" : "loans"
                    }, ${formatMoney(slice.amount)}`}
                    className="flex flex-1 flex-col justify-end rounded-t-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  >
                    <span
                      aria-hidden="true"
                      className={cn("w-full rounded-t-sm", BAR_TONES[index])}
                      style={{
                        height:
                          slice.count === 0
                            ? "2px"
                            : `${(slice.count / largest) * 100}%`,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{formatMoney(slice.amount)}</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {slices.map((slice) => (
              <span
                key={slice.stage}
                className="text-balance text-center text-caption text-muted-foreground"
              >
                {staffLabel(slice.stage)}
              </span>
            ))}
          </div>
        </div>
      )}
    </figure>
  );
}

/**
 * The chart's loading state (design frame 06-chart-loading): the real title, a muted
 * "Loading…" where the count goes, and grey bars. The title is known before the numbers
 * are, so greying it out would make the card change shape twice.
 */
export function StageBarChartSkeleton({ title }: { title: string }) {
  const heights = ["60%", "40%", "70%", "20%", "80%", "50%"];
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-section text-foreground">{title}</span>
        <span className="text-caption text-muted-foreground">Loading…</span>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-2">
        {heights.map((height) => (
          <div key={height} className="flex h-44 flex-col justify-end">
            <Skeleton className="w-full rounded-t-sm" style={{ height }} />
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-6 gap-2">
        {heights.map((height) => (
          <Skeleton key={height} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}
