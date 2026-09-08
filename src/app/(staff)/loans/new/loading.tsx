import { Skeleton } from "@/components/ui/skeleton";

/** The form's shape: a header, then the two-column grid of fields. */
export default function NewLoanLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading the new loan form</span>
      <Skeleton className="mx-6 mt-4 h-7 w-40" />
      <div className="px-6 pb-6">
        <div className="flex max-w-dialog-form flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-card">
          <Skeleton className="h-14 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <Skeleton className="h-14 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
