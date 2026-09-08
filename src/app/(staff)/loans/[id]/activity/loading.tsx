import { Skeleton } from "@/components/ui/skeleton";

/** One bordered block of 40 px rows, the shape the Activity tab lands in. */
export default function LoanActivityLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Loading this loan's activity</span>
      <Skeleton className="h-5 w-48" />
      <div className="flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-card p-px">
        {Array.from({ length: 8 }, (_, row) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows, no identity
            key={row}
            className="flex h-10 items-center gap-3 px-4"
          >
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
