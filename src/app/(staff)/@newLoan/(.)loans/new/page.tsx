import { requireActor } from "@/server/actor";
import { can } from "@/server/authz";
import { NewLoanDialog } from "./new-loan-dialog";

/**
 * The intercepted New loan route (design frame 02-new-loan): clicking "New loan" on the
 * board opens the 560 px dialog over it and the URL becomes /loans/new, so the form is
 * linkable and Back closes it. A refresh or a cold visit renders the page instead.
 */
export default async function NewLoanModal() {
  const actor = await requireActor();
  // The slot renders beside <main>, so a refusal here would sit next to the board with a
  // second h1. Render nothing and let the page at /loans/new carry the refusal.
  if (!can(actor, "loan.create")) return null;
  return <NewLoanDialog />;
}
