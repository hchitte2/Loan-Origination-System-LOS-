import type { PriorTo } from "./conditions";
import type { Purpose } from "./loan-facts";

/**
 * The default needs list a new loan starts with (PLAN.md §6 invariant 6). Instructions
 * are borrower-facing and warm; titles are what staff see. The insurance item is due
 * before funding, so a file can reach clear to close without it.
 */
export type NeedsListItem = {
  title: string;
  instructions: string;
  priorTo: PriorTo;
};

const SHARED: NeedsListItem[] = [
  {
    title: "Government photo ID",
    instructions: "A driver's license or passport, front and back.",
    priorTo: "docs",
  },
  {
    title: "Pay stubs, last 30 days",
    instructions: "Your two most recent pay stubs, all pages.",
    priorTo: "docs",
  },
  {
    title: "W-2s, last 2 years",
    instructions: "Your W-2 forms for the last two years.",
    priorTo: "docs",
  },
  {
    title: "Bank statements, last 2 months",
    instructions:
      "All pages of your checking and savings statements for the last two months.",
    priorTo: "docs",
  },
];

const PURCHASE_ONLY: NeedsListItem[] = [
  {
    title: "Purchase contract",
    instructions: "The signed purchase contract for the home.",
    priorTo: "approval",
  },
  {
    title: "Homeowners insurance binder",
    instructions:
      "Proof of insurance from your insurer, once you have chosen one.",
    priorTo: "funding",
  },
];

const REFINANCE_ONLY: NeedsListItem[] = [
  {
    title: "Mortgage statement",
    instructions: "Your most recent statement for the loan being refinanced.",
    priorTo: "docs",
  },
  {
    title: "Homeowners insurance declarations",
    instructions: "The declarations page from your current homeowners policy.",
    priorTo: "funding",
  },
];

export function defaultNeedsList(purpose: Purpose): NeedsListItem[] {
  return [
    ...SHARED,
    ...(purpose === "purchase" ? PURCHASE_ONLY : REFINANCE_ONLY),
  ];
}
