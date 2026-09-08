import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { requireActor } from "@/server/actor";
import { assertCan } from "@/server/authz";
import { loadLoan } from "../loan-detail";

export async function generateMetadata({
  params,
}: PageProps<"/loans/[id]/needs-list">): Promise<Metadata> {
  const { id } = await params;
  const loan = await loadLoan(id);
  return { title: loan ? `${loan.familyName} · Needs list` : "Needs list" };
}

/** The conditions table lands in the next step; the tab exists so it is never a 404. */
export default async function NeedsListPage({
  params,
}: PageProps<"/loans/[id]/needs-list">) {
  const actor = await requireActor();
  assertCan(actor, "condition.read");
  const { id } = await params;
  const loan = await loadLoan(id);
  if (!loan) notFound();
  return (
    <EmptyState
      icon={ListChecks}
      title="The needs list is coming."
      description="Every condition on this file, what it is due before, and how long it has been open."
    />
  );
}
