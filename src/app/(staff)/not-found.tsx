import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function StaffNotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <div className="px-6 pb-6">
        <EmptyState
          icon={SearchX}
          title="There is nothing at this address."
          description="The loan may have been removed by the daily reset, or the link is wrong."
          action={
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Go to your home
            </Link>
          }
        />
      </div>
    </>
  );
}
