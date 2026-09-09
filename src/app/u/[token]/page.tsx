import { notFound } from "next/navigation";
import { MilestoneTracker } from "@/components/public/milestone-tracker";
import { PublicNeedsList } from "@/components/public/needs-list";
import { formatDate, formatMoney } from "@/lib/format";
import { getPublicLoanView } from "@/server/queries/public";

/**
 * The borrower's page (design frames 05-public-*). No session: the token in the URL is
 * the whole of the authorization, and an unknown, revoked or closed one is the same
 * `notFound()` — the designed "no longer active" card, never a login redirect.
 *
 * Everything rendered comes from `getPublicLoanView`, which returns only
 * `PublicLoanView`. A Server Component serialises what it fetches, so fetching less is
 * the only way to show less (`.claude/rules/public.md`).
 */
export default async function PublicLoanPage({
  params,
}: PageProps<"/u/[token]">) {
  const { token } = await params;
  const view = await getPublicLoanView(token);
  if (!view) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-greeting text-foreground">
          Hi {view.borrowerFirstName}, here's where your loan stands.
        </h1>
        <p className="text-public text-muted-foreground">
          {view.property} · {formatMoney(view.amount)} · {view.programLabel}
          {view.targetCloseDate
            ? ` · Target close ${formatDate(view.targetCloseDate)}`
            : null}
        </p>
      </div>

      <MilestoneTracker
        stageIndex={view.stageIndex}
        loanOfficerFirstName={view.loanOfficer.firstName}
      />

      <PublicNeedsList view={view} token={token} />
    </div>
  );
}
