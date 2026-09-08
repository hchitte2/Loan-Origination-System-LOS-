import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SegmentedLinks } from "@/components/segmented-links";
import { requireActor } from "@/server/actor";
import { assertCan } from "@/server/authz";
import { listPipelineLoans } from "@/server/queries/loans";
import { PipelineBoard } from "./board";

export const metadata: Metadata = { title: "Pipeline" };

/**
 * Loan officer home, and the superadmin's view of every file (design frame 02-pipeline).
 * Processors work from the queue, so they are sent there.
 *
 * "Mine" is a filter, not a permission: every staff role may read every loan, and the
 * board simply narrows to the actor's own files. It lives in the URL so the server does
 * the filtering and the view can be linked to.
 */
export default async function PipelinePage(props: PageProps<"/pipeline">) {
  const actor = await requireActor();
  if (actor.role === "processor") redirect("/queue");
  assertCan(actor, "loan.read");

  const { mine } = await props.searchParams;
  const onlyMine = mine === "1";
  const loans = await listPipelineLoans(actor, { mine: onlyMine });
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Pipeline"
        action={
          <SegmentedLinks
            label="Whose loans"
            segments={[
              { href: "/pipeline?mine=1", label: "Mine", current: onlyMine },
              { href: "/pipeline", label: "All", current: !onlyMine },
            ]}
          />
        }
      />
      <div className="px-6 pb-6">
        <PipelineBoard
          loans={loans}
          emptyHint={
            onlyMine
              ? "Nothing is assigned to you right now. Switch to All to see the whole pipeline."
              : "Every file that is not funded, withdrawn or denied shows up here."
          }
          now={now}
        />
      </div>
    </>
  );
}
