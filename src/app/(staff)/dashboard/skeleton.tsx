import { StageBarChartSkeleton } from "@/components/stage-bar-chart";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the dashboard looks like while its numbers are in flight (design frame
 * 06-chart-loading): grey tiles and bars, the real titles, no figures.
 *
 * It takes `mine` because the two variants are different shapes — three tiles and one
 * chart for a loan officer, four tiles and two charts for a superadmin. A `loading.tsx`
 * could not do this: it is the static shell's fallback and renders before the session is
 * known, so it would have had to guess a role and re-lay-out under whoever guessed wrong.
 */
export function DashboardBodySkeleton({ mine }: { mine: boolean }) {
  const tiles = mine
    ? ["pipeline", "funded", "closing"]
    : ["pipeline", "funded", "pull-through", "cycle-time"];

  return (
    <div
      role="status"
      aria-busy="true"
      className="flex flex-col gap-4 px-6 pb-6"
    >
      <span className="sr-only">Loading the dashboard</span>
      <div
        className={`grid gap-3 sm:grid-cols-2 ${mine ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}
      >
        {tiles.map((tile) => (
          <div
            key={tile}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-card"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className={`grid gap-3 ${mine ? "" : "lg:grid-cols-3"}`}>
        <div className={mine ? "" : "lg:col-span-2"}>
          <StageBarChartSkeleton
            title={mine ? "My pipeline by stage" : "Pipeline by stage"}
          />
        </div>
        {mine ? null : (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
            <span className="text-section text-foreground">
              Conditions aging
            </span>
            {["0-3", "4-7", "8-14", "15+"].map((bucket) => (
              <Skeleton key={bucket} className="h-2 w-full" />
            ))}
          </div>
        )}
      </div>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
