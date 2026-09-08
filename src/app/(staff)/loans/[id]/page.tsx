import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/card";
import { InitialsAvatar } from "@/components/initials-avatar";
import { formatAddress } from "@/lib/address";
import { daysSince, daysUntil, formatDate, formatMoney } from "@/lib/format";
import {
  loanTypeLabel,
  purposeLabel,
  referralSourceLabel,
} from "@/lib/loan-facts";
import { roleLabel } from "@/lib/roles";
import { isTerminalStage, staffLabel } from "@/lib/stages";
import { requireActor } from "@/server/actor";
import { assertCan } from "@/server/authz";
import { BorrowerLink } from "./borrower-link";
import { loadLoan } from "./loan-detail";

export async function generateMetadata({
  params,
}: PageProps<"/loans/[id]">): Promise<Metadata> {
  const { id } = await params;
  const loan = await loadLoan(id);
  return {
    title: loan ? `${loan.familyName} · ${loan.propertyStreet}` : "Loan",
  };
}

/**
 * Overview (design frame 03-loan-overview): the facts, the people and dates, and the
 * borrower's link. Three cards, nothing editable yet — editing facts is not in Phase 2.
 */
export default async function LoanOverviewPage({
  params,
}: PageProps<"/loans/[id]">) {
  const actor = await requireActor();
  assertCan(actor, "loan.read");
  const { id } = await params;
  const loan = await loadLoan(id);
  if (!loan) notFound();
  const now = new Date();

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <Card title="Loan">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <Row label="Borrower">{loan.borrowerName}</Row>
          <Row label="Email">{loan.borrowerEmail}</Row>
          <Row label="Phone">{loan.borrowerPhone ?? "—"}</Row>
          <Row label="Property">
            {formatAddress({
              street: loan.propertyStreet,
              city: loan.propertyCity,
              state: loan.propertyState,
              zip: loan.propertyZip,
            })}
          </Row>
          <Row label="Purpose">{purposeLabel(loan.purpose)}</Row>
          <Row label="Program">{loanTypeLabel(loan.loanType)}</Row>
          <Row label="Amount" tabular>
            {formatMoney(loan.amount)}
          </Row>
          {loan.purchasePrice !== null ? (
            <Row label="Purchase price" tabular>
              {formatMoney(loan.purchasePrice)}
            </Row>
          ) : null}
          <Row label="Referral">{referralSourceLabel(loan.referralSource)}</Row>
        </dl>
      </Card>

      <div className="flex flex-col gap-4">
        <Card title="People">
          <ul className="flex flex-col gap-3">
            <Person
              name={loan.loanOfficer.name}
              staffRole="loan_officer"
              nmlsId={loan.loanOfficer.nmlsId}
              phone={loan.loanOfficer.phone}
            />
            {loan.processor ? (
              <Person name={loan.processor.name} staffRole="processor" />
            ) : (
              <li className="text-body text-muted-foreground">
                No processor assigned yet.
              </li>
            )}
          </ul>
        </Card>

        <Card title="Dates">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <Row label="Created">{formatDate(loan.createdAt)}</Row>
            <Row label="Application">
              {loan.applicationDate ? formatDate(loan.applicationDate) : "—"}
            </Row>
            <Row label={`In ${staffLabel(loan.stage)} since`} tabular>
              {formatDate(loan.stageEnteredAt)} ·{" "}
              {daysSince(loan.stageEnteredAt, now)} d
            </Row>
            <Row label="Target close" tabular>
              {loan.targetCloseDate ? (
                <>
                  {formatDate(loan.targetCloseDate)} ·{" "}
                  {describeDaysUntil(daysUntil(loan.targetCloseDate, now))}
                </>
              ) : (
                "—"
              )}
            </Row>
            {loan.fundedAt ? (
              <Row label="Funded">{formatDate(loan.fundedAt)}</Row>
            ) : null}
          </dl>
        </Card>
      </div>

      {/*
        Three cards, and the stage is asked first. `loan.manage_link` is a write action,
        so `can()` refuses it on a terminal loan for everyone (PLAN.md §6 invariant 8) and
        the token is withheld — which is right, but "managed by someone else" would be a
        lie told to the very people who manage it. A closed file says it is closed.
      */}
      {isTerminalStage(loan.stage) ? (
        <Card title="Borrower link">
          <p className="text-body text-muted-foreground">
            This loan is {staffLabel(loan.stage).toLowerCase()}.{" "}
            {loan.borrowerFirstName}'s link is no longer used.
          </p>
        </Card>
      ) : loan.uploadToken ? (
        <BorrowerLink
          loanId={loan.id}
          firstName={loan.borrowerFirstName}
          token={loan.uploadToken}
        />
      ) : (
        <Card title="Borrower link">
          <p className="text-body text-muted-foreground">
            {loan.borrowerFirstName}'s link is managed by the assigned loan
            officer and the processor on this file.
          </p>
        </Card>
      )}
    </div>
  );
}

/** "in 27 d", "today", "8 d ago" — a target close reads as a distance, not a date twice. */
function describeDaysUntil(days: number): string {
  if (days === 0) return "today";
  return days > 0 ? `in ${days} d` : `${Math.abs(days)} d ago`;
}

function Row({
  label,
  tabular,
  children,
}: {
  label: string;
  tabular?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-body text-muted-foreground">{label}</dt>
      <dd
        className={
          tabular
            ? "text-body text-foreground tabular-nums"
            : "text-body text-foreground"
        }
      >
        {children}
      </dd>
    </>
  );
}

function Person({
  name,
  // Not `role`: biome reads that prop name as an ARIA role on any element.
  staffRole,
  nmlsId,
  phone,
}: {
  name: string;
  staffRole: "loan_officer" | "processor";
  nmlsId?: string | null;
  phone?: string | null;
}) {
  const detail = [roleLabel(staffRole), nmlsId ? `NMLS ${nmlsId}` : null, phone]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-center gap-3">
      <InitialsAvatar name={name} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="text-body font-medium text-foreground">{name}</span>
        <span className="text-caption text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}
