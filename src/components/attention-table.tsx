import { Calendar, CircleCheck, Flag } from "lucide-react";
import Link from "next/link";
import { attentionReason } from "@/lib/analytics-math";
import { formatDate } from "@/lib/format";
import type { AttentionRow } from "@/server/queries/analytics";
import { EmptyState } from "./empty-state";
import { StagePill } from "./stage-pill";
import { Tag } from "./tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

/**
 * The files that want a decision today (design frames 06-dashboard and 06-dashboard-lo):
 * loan, stage, how long it has sat, when it is meant to close, and why it is listed.
 *
 * The reason is a chip with an icon, never colour alone, and it says the whole sentence —
 * "Stalled 12 d in Processing" — because a dashboard that makes you hover to find out
 * what is wrong is a dashboard nobody acts on. Whole rows link to the loan, so the fix is
 * one click from the reason.
 */
const REASON_ICONS = {
  stalled: Flag,
  closing_soon: Calendar,
  needs_review: Flag,
};

export function AttentionTable({ rows }: { rows: AttentionRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CircleCheck}
        title="Nothing needs attention."
        description="Files that stall, or that are closing inside two weeks, show up here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table className="table-fixed">
        <caption className="sr-only">
          Active loans wanting attention, most urgent first
        </caption>
        <colgroup>
          <col />
          <col className="w-52" />
          <col className="w-32" />
          <col className="w-32" />
          <col className="w-72" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-muted">
            <TableHead>Loan</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="text-right">Days in stage</TableHead>
            <TableHead className="text-right">Target close</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="py-2">
                <Link
                  href={`/loans/${row.id}`}
                  className="rounded-lg font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {row.familyName}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {row.propertyStreet}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <StagePill stage={row.stage} />
              </TableCell>
              <TableCell className="text-right text-foreground tabular-nums">
                {row.daysInStage} d
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {row.targetCloseDate ? formatDate(row.targetCloseDate) : "—"}
              </TableCell>
              <TableCell>
                <Tag
                  tone={
                    row.reason.kind === "closing_soon"
                      ? "destructive"
                      : "warning"
                  }
                  icon={REASON_ICONS[row.reason.kind]}
                >
                  {attentionReason(row.reason)}
                </Tag>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
