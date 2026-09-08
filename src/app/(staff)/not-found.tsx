import { SearchX } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";

export default function StaffNotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <div className="px-6 pb-6">
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6">
          <SearchX
            aria-hidden="true"
            className="size-5 text-muted-foreground"
          />
          <p className="text-body text-foreground">
            There is nothing at this address.
          </p>
          <p className="text-body text-muted-foreground">
            The loan may have been removed by the daily reset, or the link is
            wrong.
          </p>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Go to your home
          </Link>
        </div>
      </div>
    </>
  );
}
