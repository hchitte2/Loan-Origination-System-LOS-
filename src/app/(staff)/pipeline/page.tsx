import { Kanban } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireActor } from "@/server/actor";
import { assertCan } from "@/server/authz";

export const metadata: Metadata = { title: "Pipeline" };

/** Loan officer home. The board with six columns and the "Move to…" menu arrives in Phase 2. */
export default async function PipelinePage() {
  const actor = await requireActor();
  if (actor.role === "processor") redirect("/queue");
  assertCan(actor, "loan.read");
  return (
    <>
      <PageHeader title="Pipeline" />
      <div className="px-6 pb-6">
        <EmptyState
          icon={Kanban}
          title="The pipeline board is coming."
          description="One column per active stage, a card per loan, and a Move to… menu on every card."
        />
      </div>
    </>
  );
}
