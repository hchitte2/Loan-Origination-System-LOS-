import { LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatLongDate } from "@/lib/format";
import { requireActor } from "@/server/actor";

export const metadata: Metadata = { title: "Dashboard" };

/** Superadmin home; loan officers get their own variant. Analytics tiles arrive in Phase 4. */
export default async function DashboardPage() {
  const actor = await requireActor();
  if (actor.role === "processor") redirect("/queue");
  const mine = actor.role === "loan_officer";
  return (
    <>
      <PageHeader
        title={mine ? "My dashboard" : "Dashboard"}
        description={`As of ${formatLongDate(new Date())}`}
      />
      <div className="px-6 pb-6">
        <EmptyState
          icon={LayoutDashboard}
          title="Dashboard tiles are coming."
          description={
            mine
              ? "Your active pipeline, funded this month and closings in the next 14 days will show here."
              : "Active pipeline, funded this month, pull-through and cycle time will show here."
          }
        />
      </div>
    </>
  );
}
