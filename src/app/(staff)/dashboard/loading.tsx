import { StageBarChartSkeleton } from "@/components/stage-bar-chart";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The dashboard's own skeleton (design frame 06-chart-loading): four tiles and the chart
 * bars in grey, no numbers. The tiles keep their real height so the page does not jump
 * when the figures land.
 */
export default function DashboardLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col">
      <span className="sr-only">Loading the dashboard</span>
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        {/* The real heading, so the page keeps its h1 while the numbers load. */}
        <h1 className="font-display text-h1 text-foreground">Dashboard</h1>
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {["pipeline", "funded", "pull-through", "cycle-time"].map((tile) => (
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
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <StageBarChartSkeleton />
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
            <Skeleton className="h-4 w-32" />
            {["0-3", "4-7", "8-14", "15+"].map((bucket) => (
              <Skeleton key={bucket} className="h-2 w-full" />
            ))}
          </div>
        </div>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  );
}
