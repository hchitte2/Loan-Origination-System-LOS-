import type { Metadata } from "next";
import Link from "next/link";
import { ForbiddenState } from "@/components/forbidden-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireActor } from "@/server/actor";
import { can } from "@/server/authz";
import { NewLoanForm } from "./new-loan-form";

export const metadata: Metadata = { title: "New loan" };

/**
 * The New loan form as its own page. Reached by a refresh, a deep link or a visit with
 * the client router unavailable; from the board it is intercepted and shown as the 560 px
 * dialog the design specifies (see `(staff)/@newLoan`).
 */
export default async function NewLoanPage() {
  const actor = await requireActor();
  if (!can(actor, "loan.create")) {
    return (
      <ForbiddenState
        actor={actor}
        what="Creating a loan"
        title="Processors do not create loans."
      />
    );
  }
  return (
    <>
      <PageHeader title="New loan" />
      <div className="px-6 pb-6">
        <div className="max-w-dialog-form rounded-lg border border-border bg-card p-6 shadow-card">
          <NewLoanForm
            footer={
              <Link
                href="/pipeline"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Cancel
              </Link>
            }
          />
        </div>
      </div>
    </>
  );
}
