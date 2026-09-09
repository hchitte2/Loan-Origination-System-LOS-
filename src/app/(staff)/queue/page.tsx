import { ArrowRight, Coffee, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AgingBars } from "@/components/aging-bars";
import { EmptyState } from "@/components/empty-state";
import { KpiTile } from "@/components/kpi-tile";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { daysSince, formatAge } from "@/lib/format";
import { requireActor } from "@/server/actor";
import { assertCan } from "@/server/authz";
import { getQueueCounts } from "@/server/queries/conditions";
import { listReviewQueue } from "@/server/queries/documents";

export const metadata: Metadata = { title: "Queue" };

/**
 * The processor's home (design frame 04-queue): what is waiting, how much of it there is,
 * and how old the oldest has got.
 *
 * Oldest first, because the oldest document is the one keeping someone waiting. A loan
 * officer has no queue — they are sent to their pipeline.
 */
export default async function QueuePage() {
  const actor = await requireActor();
  if (actor.role === "loan_officer") redirect("/pipeline");
  assertCan(actor, "loan.read");

  const now = new Date();
  const [queue, counts] = await Promise.all([
    listReviewQueue(actor),
    getQueueCounts(actor, now),
  ]);
  const oldest = queue[0];

  return (
    <>
      <PageHeader title="Queue" />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Documents awaiting review"
            value={String(queue.length)}
            sub={
              oldest
                ? `oldest ${daysSince(oldest.createdAt, now)} d`
                : "Nothing waiting"
            }
            definition="Uploads with no decision yet, on loans still in the pipeline."
          />
          <KpiTile
            label="Open conditions"
            value={String(counts.openConditions)}
            sub="Requested or received, across active files"
            definition="Conditions still waiting on the borrower or on a reviewer."
          />
          <KpiTile
            label="Active files"
            value={String(counts.activeFiles)}
            sub="Loans in Processing or later"
            definition="A lead with nothing asked for yet is not counted."
          />
          <AgingBars buckets={counts.aging} />
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-section text-foreground">
            Documents to review
            <span className="font-normal text-muted-foreground">
              {" "}
              · oldest first
            </span>
          </h2>
        </div>

        {queue.length === 0 ? (
          <EmptyState
            icon={Coffee}
            title="Nothing to review. Enjoy the quiet."
            description="New uploads from borrowers and loan officers appear here, oldest first."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table className="table-fixed">
              <caption className="sr-only">
                Documents waiting on a reviewer, oldest first
              </caption>
              <colgroup>
                <col />
                <col className="w-52" />
                <col className="w-28" />
                <col className="w-52" />
                <col className="w-16" />
                <col className="w-24" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-muted">
                  <TableHead>File</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Loan</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                  <TableHead>
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell className="py-2">
                      <span className="flex items-center gap-2">
                        <FileText
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="truncate font-medium text-foreground">
                          {document.fileName}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {document.conditionTitle ?? "—"}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {document.familyName}
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      {document.uploadedVia === "public_link"
                        ? `via ${document.borrowerFirstName}'s link`
                        : `uploaded by ${document.uploadedByName ?? "a colleague"}`}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatAge(document.createdAt, now)}
                    </TableCell>
                    <TableCell className="py-1">
                      {/* A plain link wearing the button's clothes: this navigates, so
                          it must announce as a link, not as a button. */}
                      <Link
                        href={`/loans/${document.loanId}/needs-list`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Open
                        <ArrowRight aria-hidden="true" />
                        <span className="sr-only">
                          {document.familyName} · {document.fileName}
                        </span>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
