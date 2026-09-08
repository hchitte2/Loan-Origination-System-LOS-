import { Kanban, List } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { LoanTable } from "@/components/loan-table";
import { PageHeader } from "@/components/page-header";
import { SegmentedLinks } from "@/components/segmented-links";
import { isActiveStage } from "@/lib/stages";
import { requireActor } from "@/server/actor";
import { assertCan } from "@/server/authz";
import { listGateConditions } from "@/server/queries/conditions";
import { listPipelineLoans } from "@/server/queries/loans";
import { availableMoves } from "@/server/transitions";
import { PipelineBoard } from "./board";
import { ClosedSection } from "./closed-section";
import { MoveMenu } from "./move-menu";

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

  const { mine, view } = await props.searchParams;
  const onlyMine = mine === "1";
  const asList = view === "list";
  const loans = await listPipelineLoans(actor, { mine: onlyMine });
  // One query for every card's menu: the gates only ever look at open conditions.
  const gates = asList
    ? null
    : await listGateConditions(
        actor,
        loans.map((loan) => loan.id),
      );
  const now = new Date();
  const active = loans.filter((loan) => isActiveStage(loan.stage));
  const closed = loans.filter((loan) => !isActiveStage(loan.stage));
  const emptyHint = onlyMine
    ? "Nothing is assigned to you right now. Switch to All to see the whole pipeline."
    : "Every file that is not funded, withdrawn or denied shows up here.";
  const href = (next: { mine?: boolean; list?: boolean }) => {
    const params = new URLSearchParams();
    if (next.mine ?? onlyMine) params.set("mine", "1");
    if (next.list ?? asList) params.set("view", "list");
    const query = params.toString();
    return query ? `/pipeline?${query}` : "/pipeline";
  };

  return (
    <>
      <PageHeader
        title="Pipeline"
        action={
          <div className="flex items-center gap-2">
            <SegmentedLinks
              label="Whose loans"
              segments={[
                {
                  href: href({ mine: true }),
                  label: "Mine",
                  current: onlyMine,
                },
                {
                  href: href({ mine: false }),
                  label: "All",
                  current: !onlyMine,
                },
              ]}
            />
            <SegmentedLinks
              label="View"
              segments={[
                {
                  href: href({ list: false }),
                  label: "Board",
                  icon: Kanban,
                  current: !asList,
                },
                {
                  href: href({ list: true }),
                  label: "List",
                  icon: List,
                  current: asList,
                },
              ]}
            />
          </div>
        }
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        {asList ? (
          <>
            {active.length === 0 ? (
              <EmptyState
                icon={List}
                title="No active loans yet."
                description={emptyHint}
              />
            ) : (
              <LoanTable
                loans={active}
                caption="Loans in the pipeline"
                now={now}
              />
            )}
            {closed.length > 0 ? (
              <ClosedSection count={closed.length}>
                <LoanTable
                  loans={closed}
                  caption="Loans that have left the pipeline"
                  now={now}
                />
              </ClosedSection>
            ) : null}
          </>
        ) : (
          <PipelineBoard
            loans={loans}
            emptyHint={emptyHint}
            menuFor={(loan) => (
              <MoveMenu
                loanId={loan.id}
                familyName={loan.familyName}
                stage={loan.stage}
                moves={availableMoves(loan, actor, gates?.get(loan.id) ?? [])}
              />
            )}
            now={now}
          />
        )}
      </div>
    </>
  );
}
