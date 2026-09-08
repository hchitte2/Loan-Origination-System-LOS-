import { Skeleton } from "@/components/ui/skeleton";

/** Layout-matching skeleton for every staff route: a header line and table rows. */
export default function StaffLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex flex-col gap-4 px-6 py-6"
    >
      <span className="sr-only">Loading</span>
      <Skeleton className="h-7 w-40" />
      <div className="flex flex-col gap-2 pt-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
