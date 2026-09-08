import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireActor } from "@/server/actor";

export const metadata: Metadata = { title: "Queue" };

/** Processor home. Documents awaiting review and conditions aging arrive in Phase 3. */
export default async function QueuePage() {
  const actor = await requireActor();
  if (actor.role === "loan_officer") redirect("/pipeline");
  return (
    <>
      <PageHeader title="Queue" />
      <div className="px-6 pb-6">
        <EmptyState
          icon={Inbox}
          title="The review queue is coming."
          description="Documents awaiting review, oldest first, with conditions aging beside them."
        />
      </div>
    </>
  );
}
