import { ArrowUpRight, Calendar } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AgingBars } from "@/components/aging-bars";
import { AttentionTable } from "@/components/attention-table";
import { KpiTile } from "@/components/kpi-tile";
import { PageHeader } from "@/components/page-header";
import { StageBarChart } from "@/components/stage-bar-chart";
import { formatDate, formatLongDate, formatMoneyCompact } from "@/lib/format";
import { requireActor } from "@/server/actor";
import { assertCan } from "@/server/authz";
import { getDashboardData } from "@/server/queries/analytics";
import { getQueueCounts } from "@/server/queries/conditions";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The superadmin's front door and the loan officer's own view of it (design frames
 * 06-dashboard and 06-dashboard-lo), built from the same four components.
 *
 * The loan officer's variant is a narrower question, not a smaller screen: their files,
 * their month, their closings. Pull-through and cycle time are firm-level numbers and
 * would be noise over six loans, so they are not on it.
 *
 * A processor has no dashboard — their numbers live on the queue beside the work.
 */
export default async function DashboardPage() {
  const actor = await requireActor();
  if (actor.role === "processor") redirect("/queue");
  assertCan(actor, "analytics.view");

  // Which tiles to draw. The row scope behind them is `getDashboardData`'s own decision.
  const mine = actor.role === "loan_officer";
  const now = new Date();
  const data = await getDashboardData(actor, {}, now);
  const counts = mine ? null : await getQueueCounts(actor, now);

  const funded = data.fundedThisMonth;
  const delta = funded.count - funded.previousCount;
  const closingSoon = data.closingSoon[0];

  return (
    <>
      <PageHeader
        title={mine ? "My dashboard" : "Dashboard"}
        action={
          <span className="text-body text-muted-foreground">
            As of {formatLongDate(now)}
          </span>
        }
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div
          className={`grid gap-3 sm:grid-cols-2 ${mine ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}
        >
          <KpiTile
            label={mine ? "My active pipeline" : "Active pipeline"}
            value={formatMoneyCompact(data.activePipeline.amount)}
            unit={`${data.activePipeline.count} ${data.activePipeline.count === 1 ? "loan" : "loans"}`}
            sub="Lead through Clear to close"
            definition="Every loan still in the pipeline, from Lead through Clear to close. Funded, withdrawn and denied files are not counted."
          />
          <KpiTile
            label={mine ? "My funded this month" : "Funded this month"}
            value={formatMoneyCompact(funded.amount)}
            unit={`${funded.count} ${funded.count === 1 ? "loan" : "loans"}`}
            sub={
              mine ? (
                funded.familyNames.join(" · ") || "Nothing funded yet"
              ) : delta > 0 ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  from {funded.previousCount} last month
                </span>
              ) : (
                `${funded.previousCount} last month`
              )
            }
            definition="Loans whose funding date falls in this calendar month, against the same count for last month."
          />
          {mine ? (
            <KpiTile
              label="Closing in 14 days"
              value={String(data.closingSoon.length)}
              unit={data.closingSoon.length === 1 ? "loan" : "loans"}
              sub={
                closingSoon ? (
                  <span className="inline-flex items-center gap-1 text-warning-on-soft">
                    <Calendar aria-hidden="true" className="size-3.5" />
                    {closingSoon.familyName}
                    {closingSoon.targetCloseDate
                      ? ` · ${formatDate(closingSoon.targetCloseDate)}`
                      : ""}{" "}
                    · not yet clear to close
                  </span>
                ) : (
                  "Nothing closing in the next two weeks"
                )
              }
              definition="Files with a target close date inside 14 days that have not reached Clear to close yet."
            />
          ) : (
            <>
              <KpiTile
                label="Pull-through"
                value={
                  data.pullThrough.percent === null
                    ? "—"
                    : `${data.pullThrough.percent}%`
                }
                sub="industry ~70–78%"
                definition="Funded loans ÷ applications started 60–180 days ago."
              />
              <KpiTile
                label="Avg cycle time"
                value={
                  data.cycleTimeDays === null ? "—" : String(data.cycleTimeDays)
                }
                unit="days"
                sub="ICE avg ~37"
                definition="Mean days from application to funding, over the loans funded in the last 90 days."
              />
            </>
          )}
        </div>

        <div className={`grid gap-3 ${mine ? "" : "lg:grid-cols-3"}`}>
          <div className={mine ? "" : "lg:col-span-2"}>
            <StageBarChart
              title={mine ? "My pipeline by stage" : "Pipeline by stage"}
              slices={data.byStage}
            />
          </div>
          {counts ? <AgingBars buckets={counts.aging} /> : null}
        </div>

        <h2 className="text-section text-foreground">
          Needs attention
          <span className="font-normal text-muted-foreground">
            {" "}
            · {data.attention.length}
          </span>
        </h2>
        <AttentionTable rows={data.attention} />
      </div>
    </>
  );
}
