import { Clock } from "lucide-react";
import Link from "next/link";
import { primaryAttention } from "@/lib/analytics-math";
import { daysSince, formatMoney } from "@/lib/format";
import { loanTypeLabel } from "@/lib/loan-facts";
import type { PipelineLoan } from "@/server/queries/loans";
import { AttentionTag } from "./attention-tag";
import { InitialsAvatar } from "./initials-avatar";
import { Tag } from "./tag";

/**
 * One loan on the pipeline board (design frame 02-pipeline): family name, where the
 * property is, the amount, the program, at most one attention tag, and a footer with the
 * time in stage and the loan officer.
 *
 * The whole card is the link, so the heading's overlay covers it; `menu` sits above that
 * overlay on its own stacking level, because a button may not live inside a link.
 */
export function LoanCard({
  loan,
  menu,
  now = new Date(),
}: {
  loan: PipelineLoan;
  menu?: React.ReactNode;
  now?: Date;
}) {
  const attention = primaryAttention(loan, now);
  return (
    <article className="group/card relative flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-card transition-colors duration-150 ease-out motion-reduce:transition-none focus-within:border-muted-foreground hover:border-muted-foreground">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-body font-semibold text-foreground">
          <Link
            href={`/loans/${loan.id}`}
            className="rounded-sm outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            {loan.familyName}
            <span className="sr-only">
              {` · ${loan.propertyStreet}, ${loan.propertyCity} ${loan.propertyState}`}
            </span>
          </Link>
        </h3>
        {menu ? <div className="relative z-10">{menu}</div> : null}
      </div>
      <p className="text-caption text-muted-foreground">
        {loan.propertyCity}, {loan.propertyState}
      </p>
      <p className="text-body font-medium text-foreground tabular-nums">
        {formatMoney(loan.amount)}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag>{loanTypeLabel(loan.loanType)}</Tag>
        {attention ? <AttentionTag attention={attention} /> : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
          <Clock aria-hidden="true" className="size-4" />
          <span className="tabular-nums">
            {daysSince(loan.stageEnteredAt, now)} d in stage
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="sr-only">Loan officer {loan.loanOfficerName}</span>
          <InitialsAvatar name={loan.loanOfficerName} size="xs" />
        </span>
      </div>
    </article>
  );
}
