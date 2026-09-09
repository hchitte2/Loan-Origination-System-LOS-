import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { isOpenCondition } from "@/lib/conditions";
import { isTerminalStage } from "@/lib/stages";
import { requireActor } from "@/server/actor";
import { assertCan, can } from "@/server/authz";
import { listConditions } from "@/server/queries/conditions";
import { listLoanDocuments } from "@/server/queries/documents";
import { loadLoan } from "../loan-detail";
import { AddConditionButton } from "./condition-form";
import { ConditionsTable } from "./conditions-table";

export async function generateMetadata({
  params,
}: PageProps<"/loans/[id]/needs-list">): Promise<Metadata> {
  const { id } = await params;
  const loan = await loadLoan(id);
  return { title: loan ? `${loan.familyName} · Needs list` : "Needs list" };
}

/**
 * The needs list (design frame 03-loan-detail): what this borrower still owes, when each
 * item is due, how long it has been waiting, and — a row at a time — what has been sent
 * for it and what a reviewer decided.
 */
export default async function NeedsListPage({
  params,
}: PageProps<"/loans/[id]/needs-list">) {
  const actor = await requireActor();
  assertCan(actor, "condition.read");
  const { id } = await params;
  const loan = await loadLoan(id);
  if (!loan) notFound();

  const [conditions, documents] = await Promise.all([
    listConditions(actor, loan.id),
    listLoanDocuments(actor, loan.id),
  ]);
  // A closed loan is a record: `can()` refuses a write on one (PLAN.md §6 invariant 8),
  // so asking it is enough for the controls to stop offering any of these.
  const permissions = {
    manage: can(actor, "condition.manage", loan),
    resolve: can(actor, "condition.resolve", loan),
    review: can(actor, "document.review", loan),
    upload: can(actor, "document.upload", loan),
    // The loan-level half. Whether *this* file may go also depends on who sent it and
    // whether anyone has reviewed it, which the panel checks against `actorUserId` and
    // the action re-checks against the row.
    delete: can(actor, "document.delete", loan),
  };
  const mayManage = permissions.manage;
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
        <ConditionsTable
          loanId={loan.id}
          borrowerFirstName={loan.borrowerFirstName}
          conditions={conditions}
          documents={documents}
          permissions={permissions}
          viewerUserId={actor.userId}
          now={now.toISOString()}
        />
      )}
    </div>
  );
}
