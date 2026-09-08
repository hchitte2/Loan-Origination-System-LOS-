import {
  Check,
  Circle,
  CircleCheck,
  CircleMinus,
  CircleX,
  FileText,
  ListChecks,
  Loader,
  type LucideIcon,
  Search,
} from "lucide-react";
import { type Stage, staffLabel } from "@/lib/stages";
import { Pill, type PillTone } from "./pill";

/**
 * The stage a loan is in, as staff see it (design-system skill, "Icons" and "Recipes").
 * Active stages wear their column's chart colour at 22 %; the three terminal stages
 * borrow the semantic tones, because "Funded" and "Denied" are outcomes, not columns.
 * Labels come from `stages.ts` and are never inlined.
 */
export const STAGE_ICONS = {
  lead: Circle,
  application: FileText,
  processing: Loader,
  underwriting: Search,
  conditional_approval: ListChecks,
  clear_to_close: Check,
  funded: CircleCheck,
  withdrawn: CircleMinus,
  denied: CircleX,
} as const satisfies Record<Stage, LucideIcon>;

const STAGE_TONES = {
  lead: "stage-1",
  application: "stage-2",
  processing: "stage-3",
  underwriting: "stage-4",
  conditional_approval: "stage-5",
  clear_to_close: "stage-6",
  funded: "success",
  withdrawn: "neutral",
  denied: "destructive",
} as const satisfies Record<Stage, PillTone>;

export function StagePill({
  stage,
  className,
}: {
  stage: Stage;
  className?: string;
}) {
  return (
    <Pill
      tone={STAGE_TONES[stage]}
      icon={STAGE_ICONS[stage]}
      className={className}
    >
      {staffLabel(stage)}
    </Pill>
  );
}
