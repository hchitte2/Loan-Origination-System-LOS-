import { Activity } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityIcon } from "@/app/(staff)/admin/activity/activity-icon";
import { EmptyState } from "@/components/empty-state";
import { activityActor, activityText } from "@/lib/activity-sentence";
import { formatRelative } from "@/lib/format";
import { requireActor } from "@/server/actor";
import { assertCan } from "@/server/authz";
import { listLoanActivity } from "@/server/queries/activity";
import { loadLoan } from "../loan-detail";

export async function generateMetadata({
  params,
}: PageProps<"/loans/[id]/activity">): Promise<Metadata> {
  const { id } = await params;
  const loan = await loadLoan(id);
  return {
    title: loan ? `${loan.familyName} · Activity` : "Activity",
  };
}

/**
 * The loan's Activity tab (design frame 03-loan-activity): every mutation on this file,
 * newest first, as one sentence per row. The log is append-only, and the footnote says
 * so, because that is the point of showing it.
 */
export default async function LoanActivityPage({
  params,
}: PageProps<"/loans/[id]/activity">) {
  const actor = await requireActor();
  assertCan(actor, "activity.read_loan");
  const { id } = await params;
  const loan = await loadLoan(id);
  if (!loan) notFound();
  const rows = await listLoanActivity(actor, loan.id);
  const now = new Date();

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-section text-foreground">
        Activity{" "}
        <span className="font-normal text-muted-foreground">
          · newest first
        </span>
      </h2>
      {rows.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nothing has happened on this loan yet."
          description="Every move, condition and document shows up here as it happens."
        />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-card">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex min-h-10 items-center gap-3 border-b border-border px-4 py-2 last:border-b-0"
            >
              <ActivityIcon action={row.action} tone="semantic" />
              <span className="min-w-0 flex-1 text-body text-foreground">
                <span className="font-medium">{activityActor(row)}</span>{" "}
                {activityText(row)}
              </span>
              <time
                dateTime={row.createdAt.toISOString()}
                className="shrink-0 text-caption text-muted-foreground tabular-nums"
              >
                {formatRelative(row.createdAt, now)}
              </time>
            </li>
          ))}
        </ul>
      )}
      <p className="text-caption text-muted-foreground">
        The activity log is append-only. Entries record who acted and, when
        viewing as someone, on whose behalf.
      </p>
    </div>
  );
}
