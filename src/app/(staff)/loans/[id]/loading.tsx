import { Skeleton } from "@/components/ui/skeleton";

/**
 * Renders inside the loan layout, so the header, the meta row and the tabs stay put and
 * only the tab's body is replaced. Three card blocks, the shape the Overview tab lands in.
 */
export default function LoanDetailLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3"
    >
      <span className="sr-only">Loading the loan</span>
      <Skeleton className="h-72 w-full rounded-lg" />
      <Skeleton className="h-72 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}
