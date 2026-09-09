import { Activity } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { ForbiddenState } from "@/components/forbidden-state";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACTIVITY_FILTERS,
  type ActivityFilter,
  activityFilterLabel,
  filterForAction,
  isActivityFilter,
} from "@/lib/activity";
import { activityActor, activityText } from "@/lib/activity-sentence";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireActor } from "@/server/actor";
import { can } from "@/server/authz";
import { listGlobalActivity } from "@/server/queries/activity";
import { ActivityIcon } from "./activity-icon";
import { ResetDemoButton } from "./reset-button";

export const metadata: Metadata = { title: "Activity log" };

const EMPTY_COPY: Record<ActivityFilter, string> = {
  all: "Every change shows up here the moment it happens.",
  loans:
    "Loan events appear when a loan is created, edited or its link regenerated.",
  stage_changes: "Stage moves appear when a loan changes column.",
  documents: "Uploads, acceptances and rejections appear as documents move.",
  conditions: "Condition changes appear as needs lists are worked.",
  users: "New staff accounts appear when you create one.",
  impersonation: "Rows appear when you view as someone and when you exit.",
  resets: "The daily reset writes one row each morning.",
};

/**
 * Superadmin only (design frame 07-activity): the global log, newest first, filtered by
 * type. Impersonation rows say who really acted; nothing here can be edited or deleted.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const actor = await requireActor();
  if (!can(actor, "admin.read_activity")) {
    return <ForbiddenState actor={actor} what="The activity log" />;
  }
  const { filter: raw } = await searchParams;
  const filter: ActivityFilter = isActivityFilter(raw) ? raw : "all";
  const rows = await listGlobalActivity(actor, { filter, limit: 100 });
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Activity log"
        action={can(actor, "admin.reset_demo") ? <ResetDemoButton /> : null}
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <nav aria-label="Filter by type" className="flex flex-wrap gap-2">
          {ACTIVITY_FILTERS.map((value) => {
            const active = value === filter;
            return (
              <Link
                key={value}
                href={
                  value === "all"
                    ? "/admin/activity"
                    : `/admin/activity?filter=${value}`
                }
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-lg border px-3 text-control transition-colors duration-150 ease-out motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {activityFilterLabel(value)}
              </Link>
            );
          })}
        </nav>

        {rows.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Nothing here yet."
            description={EMPTY_COPY[filter]}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-muted">
                  <TableHead className="w-px">
                    <span className="sr-only">Type icon</span>
                  </TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Loan</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pr-0">
                      <ActivityIcon action={row.action} />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <span className="font-medium text-foreground">
                        {activityActor(row)}
                      </span>{" "}
                      <span className="text-foreground">
                        {activityText(row)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.loanLabel ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {activityFilterLabel(filterForAction(row.action))}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      <time dateTime={row.createdAt.toISOString()}>
                        {formatRelative(row.createdAt, now)}
                      </time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-caption text-muted-foreground">
          Append-only. Rows cannot be edited or deleted; the daily reset clears
          them with the rest of the demo data.
        </p>
      </div>
    </>
  );
}
