import { Calendar, FileText, Flag } from "lucide-react";
import type { Attention } from "@/lib/analytics-math";
import { attentionLabel } from "@/lib/analytics-math";
import { Tag } from "./tag";

/**
 * Why a loan wants attention, as the icon-and-text tag the design gives a loan card
 * (design-system skill, "Icons": needs review `file-text`, stalled `flag`, closing soon
 * `calendar` in a destructive tone). The words come from `analytics-math.ts`, so the
 * card and the dashboard can never disagree about what "stalled" means.
 */
const ICONS = {
  needs_review: FileText,
  stalled: Flag,
  closing_soon: Calendar,
} as const;

export function AttentionTag({ attention }: { attention: Attention }) {
  return (
    <Tag
      tone={attention.kind === "closing_soon" ? "destructive" : "warning"}
      icon={ICONS[attention.kind]}
    >
      {attentionLabel(attention)}
    </Tag>
  );
}
