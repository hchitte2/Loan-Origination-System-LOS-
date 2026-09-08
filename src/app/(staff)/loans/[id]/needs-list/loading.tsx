import { Skeleton } from "@/components/ui/skeleton";

/** The needs-list table's shape: a heading row, then six 40 px rows under a header. */
export default function NeedsListLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Loading the needs list</span>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Skeleton className="h-9 w-full rounded-none" />
        {Array.from({ length: 6 }, (_, row) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows, no identity
            key={row}
            className="flex h-10 items-center gap-4 border-b border-border px-4 last:border-b-0"
          >
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-pill w-28 rounded-lg" />
            <Skeleton className="h-tag w-24 rounded-lg" />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
