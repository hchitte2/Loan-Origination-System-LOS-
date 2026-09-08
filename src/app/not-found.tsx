import { SearchX } from "lucide-react";
import Link from "next/link";
import { DemoBadge } from "@/components/demo-badge";
import { buttonVariants } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

/** Global 404, outside every shell: plain words and a way back. */
export default function NotFound() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <DemoBadge className="absolute top-6 right-6" />
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center gap-6 px-4 py-24">
        <Wordmark size="login" />
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-card p-6">
          <SearchX
            aria-hidden="true"
            className="size-5 text-muted-foreground"
          />
          <h1 className="text-section text-foreground">
            There is nothing at this address.
          </h1>
          <p className="text-body text-muted-foreground">
            The link may be wrong, or the page it pointed to was cleared by the
            daily reset.
          </p>
          <Link href="/" className={buttonVariants({ variant: "default" })}>
            Go to Clearline
          </Link>
        </div>
      </main>
    </div>
  );
}
