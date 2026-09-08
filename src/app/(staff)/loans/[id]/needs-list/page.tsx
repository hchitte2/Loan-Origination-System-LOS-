import { EyeOff, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConditionPill } from "@/components/condition-pill";
import { EmptyState } from "@/components/empty-state";
import { Tag } from "@/components/tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isOpenCondition, priorToLabel } from "@/lib/conditions";
import { daysSince } from "@/lib/format";
import { isTerminalStage } from "@/lib/stages";
import { requireActor } from "@/server/actor";
import { assertCan, can } from "@/server/authz";
import { listConditions } from "@/server/queries/conditions";
import { loadLoan } from "../loan-detail";
import { AddConditionButton } from "./condition-form";
import { ConditionMenu } from "./condition-menu";

export async function generateMetadata({
  params,
}: PageProps<"/loans/[id]/needs-list">): Promise<Metadata> {
  const { id } = await params;
  const loan = await loadLoan(id);
  return { title: loan ? `${loan.familyName} · Needs list` : "Needs list" };
}

/**
 * The needs list (design frame 03-loan-detail): what this borrower still owes, when each
 * item is due and how long it has been waiting. Documents, clearing and waiving arrive in
 * Phase 3; Phase 2 manages the list itself.
 */
export default async function NeedsListPage({
  params,
}: PageProps<"/loans/[id]/needs-list">) {
  const actor = await requireActor();
  assertCan(actor, "condition.read");
  const { id } = await params;
  const loan = await loadLoan(id);
  if (!loan) notFound();

  const conditions = await listConditions(actor, loan.id);
  // A closed loan is a record: `can()` refuses a write on one (PLAN.md §6 invariant 8),
  // so asking it is enough for the controls to stop offering it.
  const mayManage = can(actor, "condition.manage", loan);
  const open = conditions.filter((c) => isOpenCondition(c.status)).length;
  const now = new Date();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-section text-foreground">
          Needs list
          {conditions.length > 0 ? (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {open} open of {conditions.length}
            </span>
          ) : null}
        </h2>
        {mayManage ? <AddConditionButton loanId={loan.id} /> : null}
      </div>

      {conditions.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={
            isTerminalStage(loan.stage)
              ? "This loan closed with an empty needs list."
              : "Nothing is being asked for yet."
          }
          description={
            // A closed loan is read-only for everyone (invariant 8), so `mayManage` is
            // false there for the very people the second sentence would blame.
            isTerminalStage(loan.stage)
              ? `Nothing was ever asked of ${loan.borrowerFirstName}.`
              : mayManage
                ? "Add a condition and it shows up on the borrower's page straight away."
                : "The loan officer on this file has not asked for anything yet."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table className="table-fixed">
            <caption className="sr-only">
              Conditions on this loan, soonest due first
            </caption>
            <colgroup>
              <col />
              <col className="w-40" />
              <col className="w-36" />
              <col className="w-20" />
              <col className="w-12" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-muted">
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
              {conditions.map((condition) => (
                <TableRow key={condition.id}>
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
                    {daysSince(condition.createdAt, now)} d
                  </TableCell>
                  <TableCell className="py-1">
                    {mayManage ? (
                      <ConditionMenu
                        loanId={loan.id}
                        condition={condition}
                        borrowerFirstName={loan.borrowerFirstName}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
