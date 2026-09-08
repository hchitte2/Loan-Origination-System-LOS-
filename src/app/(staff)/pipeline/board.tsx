import { Kanban } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LoanCard } from "@/components/loan-card";
import { STAGE_ICONS } from "@/components/stage-pill";
import { formatMoney } from "@/lib/format";
import {
  ACTIVE_STAGES,
  type ActiveStage,
  isActiveStage,
  staffLabel,
} from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { PipelineLoan } from "@/server/queries/loans";

/**
 * The board (design frame 02-pipeline): one column per active stage, each headed by its
 * count and total and underlined in that stage's chart colour. Terminal loans are not
 * here — they live under "Closed" in the list view.
 */

/** The 2 px column rule. Written out so Tailwind sees every class. */
export const COLUMN_RULE = {
  lead: "border-chart-1",
  application: "border-chart-2",
  processing: "border-chart-3",
  underwriting: "border-chart-4",
  conditional_approval: "border-chart-5",
  clear_to_close: "border-chart-6",
} as const satisfies Record<ActiveStage, string>;

/** What arrives in an empty column, in the compact staff voice. */
const EMPTY_HINT = {
  lead: "New files start here. Create one with New loan.",
  application: "Files move here once the borrower has applied.",
  processing:
    "Files move here when a loan officer starts collecting documents.",
  underwriting: "Files move here when a processor submits them.",
  conditional_approval: "Files move here when underwriting returns conditions.",
  clear_to_close: "Files move here once everything due before docs is cleared.",
} as const satisfies Record<ActiveStage, string>;

export function PipelineBoard({
  loans,
  emptyHint,
  menuFor,
  now,
}: {
  loans: PipelineLoan[];
  /** The line under "No loans on this board yet." when every column is empty. */
  emptyHint: string;
  /** The card's "Move to…" menu, built per loan by the page. */
  menuFor?: (loan: PipelineLoan) => React.ReactNode;
  now: Date;
}) {
  // Six identical dashed boxes say less than one sentence, and an empty scroll container
  // with nothing tabbable inside is an axe violation on a narrow viewport. The board only
  // draws active stages, so a set of purely terminal loans is still an empty board.
  const active = loans.filter((loan) => isActiveStage(loan.stage));
  if (active.length === 0) {
    return (
      <EmptyState
        icon={Kanban}
        title="No loans on this board yet."
        description={emptyHint}
      />
    );
  }
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-5xl grid-cols-6 gap-3">
        {ACTIVE_STAGES.map((stage) => {
          const column = active.filter((loan) => loan.stage === stage);
          const total = column.reduce((sum, loan) => sum + loan.amount, 0);
          return (
            <section key={stage} aria-labelledby={`column-${stage}`}>
              <div
                className={cn(
                  "flex flex-col gap-0.5 border-b-2 pb-2",
                  COLUMN_RULE[stage],
                )}
              >
                <h2
                  id={`column-${stage}`}
                  className="text-control font-semibold text-foreground"
                >
                  {staffLabel(stage)}
                </h2>
                <p className="text-caption text-muted-foreground tabular-nums">
                  {column.length} · {formatMoney(total)}
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-3">
                {column.length === 0 ? (
                  <EmptyState
                    icon={STAGE_ICONS[stage]}
                    title={`No loans in ${staffLabel(stage)}.`}
                    description={EMPTY_HINT[stage]}
                    className="px-3 py-8"
                  />
                ) : (
                  column.map((loan) => (
                    <LoanCard
                      key={loan.id}
                      loan={loan}
                      menu={menuFor?.(loan)}
                      now={now}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
