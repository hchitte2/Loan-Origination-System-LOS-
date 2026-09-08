import {
  Circle,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { type ConditionStatus, conditionStaffLabel } from "@/lib/conditions";
import { Pill, type PillTone } from "./pill";

/**
 * A condition's status as staff see it (design-system skill, "Icons"). A `requested`
 * condition whose last upload was rejected reads "Needs another" in destructive with a
 * `circle-alert`, per `design/handoff/html/data.js`: it is the one row where the borrower
 * must act again, and warning would make it indistinguishable from "Received".
 */
const ICONS = {
  requested: Circle,
  received: Clock,
  cleared: CircleCheck,
  waived: CircleMinus,
} as const satisfies Record<ConditionStatus, LucideIcon>;

const TONES = {
  requested: "neutral",
  received: "warning",
  cleared: "success",
  waived: "neutral",
} as const satisfies Record<ConditionStatus, PillTone>;

export function ConditionPill({
  status,
  lastRejectionReason,
}: {
  status: ConditionStatus;
  lastRejectionReason?: string | null;
}) {
  const rejected = status === "requested" && Boolean(lastRejectionReason);
  return (
    <Pill
      tone={rejected ? "destructive" : TONES[status]}
      icon={rejected ? CircleAlert : ICONS[status]}
    >
      {rejected ? "Needs another" : conditionStaffLabel(status)}
    </Pill>
  );
}
