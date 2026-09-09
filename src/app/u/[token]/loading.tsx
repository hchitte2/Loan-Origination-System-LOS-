import { Skeleton } from "@/components/ui/skeleton";

/** The borrower page while it loads: the real layout in grey, never a spinner. */
export default function PublicLoanLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-4/5" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-6 w-56" />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-36 w-full rounded-lg" />
      ))}
    </div>
  );
}
