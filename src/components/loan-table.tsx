import Link from "next/link";
import { daysSince, formatDate, formatMoney } from "@/lib/format";
import { loanTypeLabel } from "@/lib/loan-facts";
import { isTerminalStage } from "@/lib/stages";
import type { PipelineLoan } from "@/server/queries/loans";
import { InitialsAvatar } from "./initials-avatar";
import { StagePill } from "./stage-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

/**
 * The pipeline's list view (design frame 02-pipeline-list). Amounts, time in stage and
 * the target close are right-aligned and tabular; the stage is a `Pill`, never a bare
 * word. The whole row links to the loan through an overlay on the borrower's name,
 * because a table cell may not wrap a row.
 *
 * A closed loan has no clock running and no target close left to hit, so those two
 * columns fall silent; a funded one says when it funded instead.
 */
export function LoanTable({
  loans,
  caption,
  now,
}: {
  loans: PipelineLoan[];
  /** Visually hidden; says which slice of the pipeline this table holds. */
  caption: string;
  now: Date;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table className="table-fixed">
        <caption className="sr-only">{caption}</caption>
        {/* The grid is declared once so the Closed table lines up under the active one;
            Property takes whatever is left. */}
        <colgroup>
          <col className="w-28" />
          <col />
          <col className="w-44" />
          <col className="w-28" />
          <col className="w-28" />
          <col className="w-20" />
          <col className="w-36" />
          <col className="w-32" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-muted">
            <TableHead>Borrower</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Program</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">In stage</TableHead>
            <TableHead>Loan officer</TableHead>
            <TableHead className="text-right">Target close</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((loan) => (
            <TableRow key={loan.id} className="relative">
              <TableCell className="font-medium text-foreground">
                <Link
                  href={`/loans/${loan.id}`}
                  className="rounded-sm outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  {loan.familyName}
                  <span className="sr-only">
                    {` · ${loan.propertyStreet}, ${loan.propertyCity} ${loan.propertyState}`}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="truncate text-muted-foreground">
                {loan.propertyStreet}, {loan.propertyCity}, {loan.propertyState}
              </TableCell>
              <TableCell className="py-1">
                <StagePill stage={loan.stage} />
              </TableCell>
              <TableCell>{loanTypeLabel(loan.loanType)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(loan.amount)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {isTerminalStage(loan.stage) ? (
                  <Dash />
                ) : (
                  `${daysSince(loan.stageEnteredAt, now)} d`
                )}
              </TableCell>
              <TableCell className="py-1">
                <span className="flex items-center gap-2">
                  <InitialsAvatar name={loan.loanOfficerName} size="xs" />
                  {loan.loanOfficerName}
                </span>
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {/* A closed file has no date left to hit: funded says when, the other two
                    say nothing rather than advertising a close that will never happen. */}
                {loan.fundedAt ? (
                  `funded ${formatDate(loan.fundedAt)}`
                ) : isTerminalStage(loan.stage) || !loan.targetCloseDate ? (
                  <Dash />
                ) : (
                  formatDate(loan.targetCloseDate)
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** An em dash that assistive technology reads as "none" rather than spelling it. */
function Dash() {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">None</span>
    </>
  );
}
