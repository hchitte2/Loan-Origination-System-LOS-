import { Skeleton } from "@/components/ui/skeleton";

/** The form's shape: a header, then the two-column grid of fields. */
export default function NewLoanLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading the new loan form</span>
      {/* The real heading, so the page keeps its h1 while the form loads. */}
      <h1 className="px-6 pt-4 font-display text-h1 text-foreground">
        New loan
      </h1>
      <div className="px-6 pb-6">
        <div className="flex max-w-dialog-form flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-card">
          <Skeleton className="h-14 w-full" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          {/* Property address carries a hint line under it. */}
          <Skeleton className="h-[4.5rem] w-full" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-14 w-full" />
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
            <Skeleton className="h-3 w-64" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
