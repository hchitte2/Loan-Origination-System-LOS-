import { Skeleton } from "@/components/ui/skeleton";

/**
 * The loan detail's *whole* shape, header included. `[id]/loading.tsx` sits inside the
 * loan layout and only covers a tab change; arriving from the board suspends the layout
 * itself, and without this the fallback would be the staff group's table skeleton, which
 * is nothing like a loan.
 *
 * `/loans/new` has its own nested `loading.tsx`, which wins for that route.
 */
export default function LoansLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col">
      <span className="sr-only">Loading the loan</span>
      <div className="flex flex-col gap-3 px-6 pt-4">
        <Skeleton className="h-4 w-20" />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-80" />
            <Skeleton className="h-pill w-28 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-[36rem]" />
        </div>
        <div className="flex gap-4 border-b border-border pb-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 px-6 pt-4 pb-6 lg:grid-cols-3">
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    </div>
  );
}
