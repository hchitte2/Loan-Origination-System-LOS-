"use client";

import { ChevronRight, EyeOff } from "lucide-react";
import { useState } from "react";
import { ConditionPill } from "@/components/condition-pill";
import { Tag } from "@/components/tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { priorToLabel } from "@/lib/conditions";
import { daysSince } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConditionRow } from "@/server/queries/conditions";
import type { LoanDocument } from "@/server/queries/documents";
import { ConditionMenu } from "./condition-menu";
import { ConditionPanel } from "./condition-panel";

/**
 * The needs list (design frame 03-loan-detail): one row per condition, expanding to the
 * documents hung on it.
 *
 * It is a client component only because a row opens and closes. Everything it can do is
 * a Server Action, and every one of them re-checks the actor — the chevron decides what
 * is on screen, never what is allowed.
 */
export function ConditionsTable({
  loanId,
  borrowerFirstName,
  conditions,
  documents,
  permissions,
  now,
}: {
  loanId: string;
  borrowerFirstName: string;
  conditions: ConditionRow[];
  documents: LoanDocument[];
  permissions: {
    manage: boolean;
    resolve: boolean;
    review: boolean;
    upload: boolean;
  };
  /** Taken on the server, so the ages do not shift between render and hydration. */
  now: string;
}) {
  const nowDate = new Date(now);
  // The first condition holding something to review opens by itself, which is what the
  // frame shows and what a processor arriving from the queue is here to do.
  const [open, setOpen] = useState<string | null>(
    () =>
      conditions.find((condition) =>
        documents.some(
          (d) => d.conditionId === condition.id && d.reviewStatus === "pending",
        ),
      )?.id ?? null,
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table className="table-fixed">
        <caption className="sr-only">
          Conditions on this loan, soonest due first. Each row expands to the
          documents sent for it.
        </caption>
        <colgroup>
          <col className="w-10" />
          <col />
          <col className="w-40" />
          <col className="w-36" />
          <col className="w-20" />
          <col className="w-12" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-muted">
            <TableHead>
              <span className="sr-only">Expand</span>
            </TableHead>
            <TableHead>Condition</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Prior to</TableHead>
            <TableHead className="text-right">Age</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conditions.map((condition) => {
            const theirs = documents.filter(
              (d) => d.conditionId === condition.id,
            );
            const expanded = open === condition.id;
            const panelId = `condition-panel-${condition.id}`;
            return [
              <TableRow key={condition.id}>
                <TableCell className="py-1">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpen(expanded ? null : condition.id)}
                    className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight
                      aria-hidden="true"
                      className={cn(
                        "size-4 transition-transform duration-150 ease-out motion-reduce:transition-none",
                        expanded && "rotate-90",
                      )}
                    />
                    <span className="sr-only">
                      {expanded ? "Hide" : "Show"} documents for{" "}
                      {condition.title}
                      {theirs.length > 0 ? ` · ${theirs.length}` : " · none"}
                    </span>
                  </button>
                </TableCell>
                <TableCell className="py-2">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {condition.title}
                    </span>
                    {condition.borrowerFacing ? null : (
                      <Tag icon={EyeOff}>Internal</Tag>
                    )}
                  </span>
                </TableCell>
                <TableCell className="py-1">
                  <ConditionPill
                    status={condition.status}
                    lastRejectionReason={condition.lastRejectionReason}
                  />
                </TableCell>
                <TableCell className="py-1">
                  <Tag>{priorToLabel(condition.priorTo)}</Tag>
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {daysSince(condition.createdAt, nowDate)} d
                </TableCell>
                <TableCell className="py-1">
                  {permissions.manage ? (
                    <ConditionMenu
                      loanId={loanId}
                      condition={condition}
                      borrowerFirstName={borrowerFirstName}
                      documentCount={theirs.length}
                    />
                  ) : null}
                </TableCell>
              </TableRow>,
              expanded ? (
                <TableRow
                  key={`${condition.id}-panel`}
                  className="hover:bg-transparent"
                >
                  <TableCell colSpan={6} className="p-0">
                    <ConditionPanel
                      id={panelId}
                      loanId={loanId}
                      borrowerFirstName={borrowerFirstName}
                      condition={condition}
                      documents={theirs}
                      permissions={permissions}
                      now={nowDate}
                    />
                  </TableCell>
                </TableRow>
              ) : null,
            ];
          })}
        </TableBody>
      </Table>
    </div>
  );
}
