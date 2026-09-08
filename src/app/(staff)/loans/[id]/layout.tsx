import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InitialsAvatar } from "@/components/initials-avatar";
import { StagePill } from "@/components/stage-pill";
import { formatDate, formatMoney } from "@/lib/format";
import { loanTypeLabel, purposeLabel } from "@/lib/loan-facts";
import { homeRoute } from "@/lib/roles";
import { requireActor } from "@/server/actor";
import { assertCan } from "@/server/authz";
import { loadLoan } from "./loan-detail";
import { LoanTabs } from "./loan-tabs";

/**
 * The loan detail shell (design frame 03-loan-detail): a way back, the file's name and
 * stage, the meta row, and the three tabs. Every tab renders inside it, so the header is
 * fetched once per request and shared through `loadLoan`.
 */
export default async function LoanLayout({
  children,
  params,
}: LayoutProps<"/loans/[id]">) {
  const actor = await requireActor();
  assertCan(actor, "loan.read");
  const { id } = await params;
  const loan = await loadLoan(id);
  if (!loan) notFound();

  const home = homeRoute(actor.role);
  return (
    <>
      <div className="flex flex-col gap-3 px-6 pt-4">
        <Link
          href={home}
          className="inline-flex w-fit items-center gap-1.5 rounded-sm text-caption text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {home === "/queue"
            ? "Queue"
            : home === "/pipeline"
              ? "Pipeline"
              : "Dashboard"}
        </Link>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-h1 text-foreground">
              {loan.familyName} · {loan.propertyStreet}
            </h1>
            <StagePill stage={loan.stage} />
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-control font-normal text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {formatMoney(loan.amount)}
            </span>
            <Dot />
            <span>
              {loanTypeLabel(loan.loanType)}{" "}
              {purposeLabel(loan.purpose).toLowerCase()}
            </span>
            {loan.targetCloseDate ? (
              <>
                <Dot />
                <span>Target close {formatDate(loan.targetCloseDate)}</span>
              </>
            ) : null}
            <Dot />
            <span className="inline-flex items-center gap-1.5">
              Loan officer
              <InitialsAvatar name={loan.loanOfficer.name} size="xs" />
              <span className="text-foreground">{loan.loanOfficer.name}</span>
            </span>
            {loan.processor ? (
              <>
                <Dot />
                <span className="inline-flex items-center gap-1.5">
                  Processor
                  <InitialsAvatar name={loan.processor.name} size="xs" />
                  <span className="text-foreground">{loan.processor.name}</span>
                </span>
              </>
            ) : null}
          </p>
        </div>
        <LoanTabs loanId={loan.id} />
      </div>
      <div className="px-6 pt-4 pb-6">{children}</div>
    </>
  );
}

/** The separator the meta row uses; hidden so it is not read as punctuation. */
function Dot() {
  return (
    <span aria-hidden="true" className="text-muted-foreground">
      ·
    </span>
  );
}
