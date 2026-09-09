import { CircleCheck, CircleX, Clock, type LucideIcon } from "lucide-react";
import { type ReviewStatus, reviewStatusLabel } from "@/lib/doc-types";
import { Pill, type PillTone } from "./pill";

/**
 * A document's review status as staff see it (design-system skill, "Icons"). The
 * borrower never sees this vocabulary — their page speaks in condition statuses, where
 * a rejection reads "Needs another: <reason>".
 */
const ICONS = {
  pending: Clock,
  accepted: CircleCheck,
  rejected: CircleX,
} as const satisfies Record<ReviewStatus, LucideIcon>;

const TONES = {
  pending: "warning",
  accepted: "success",
  rejected: "destructive",
} as const satisfies Record<ReviewStatus, PillTone>;

export function ReviewPill({ status }: { status: ReviewStatus }) {
  return (
    <Pill tone={TONES[status]} icon={ICONS[status]}>
      {reviewStatusLabel(status)}
    </Pill>
  );
}
