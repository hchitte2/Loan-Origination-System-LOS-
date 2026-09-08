import { SearchX } from "lucide-react";
import Link from "next/link";
import { DemoBadge } from "@/components/demo-badge";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

/** Global 404, outside every shell: plain words and a way back. */
export default function NotFound() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <aside aria-label="Demo notice" className="absolute top-6 right-6">
        <DemoBadge />
      </aside>
      <main className="mx-auto flex w-full max-w-login flex-1 flex-col justify-center gap-6 px-4 py-24">
        <h1>
          <Wordmark size="login" />
        </h1>
        <EmptyState
          icon={SearchX}
          title="There is nothing at this address."
          description="The link may be wrong, or the page it pointed to was cleared by the daily reset."
          action={
            <Link href="/" className={buttonVariants({ variant: "default" })}>
              Go to Clearline
            </Link>
          }
        />
      </main>
    </div>
  );
}
