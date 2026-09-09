import {
  ArrowRight,
  CircleCheck,
  CircleMinus,
  CircleX,
  Copy,
  Eye,
  Link2,
  type LucideIcon,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import type { ActivityAction } from "@/lib/activity";
import { cn } from "@/lib/utils";

const ICONS: Record<ActivityAction, LucideIcon> = {
  "loan.created": Plus,
  "loan.updated": Pencil,
  "loan.stage_changed": ArrowRight,
  "loan.link_regenerated": Link2,
  "loan.link_copied": Copy,
  "condition.created": Plus,
  "condition.updated": Pencil,
  "condition.cleared": CircleCheck,
  "condition.waived": CircleMinus,
  "condition.deleted": Trash2,
  "document.uploaded": Upload,
  "document.accepted": CircleCheck,
  "document.rejected": CircleX,
  "document.deleted": Trash2,
  "admin.user_created": Users,
  "admin.impersonation_started": Eye,
  "admin.impersonation_ended": Eye,
  "demo.reset": RotateCcw,
};

/** Outcomes carry their tone on the loan's Activity tab; the global log stays neutral. */
const TONES: Partial<Record<ActivityAction, string>> = {
  "document.accepted": "text-success-on-soft",
  "condition.cleared": "text-success-on-soft",
  "document.rejected": "text-destructive",
};

/**
 * The 16 px lucide icon for an activity row; decorative, the sentence says it all.
 * `tone="semantic"` colours the three outcome rows the way frame 03-loan-activity does.
 * The global log (frame 07-activity) shows every row grey, so that stays the default.
 */
export function ActivityIcon({
  action,
  tone = "muted",
}: {
  action: ActivityAction;
  tone?: "muted" | "semantic";
}) {
  const Icon = ICONS[action];
  const colour =
    (tone === "semantic" ? TONES[action] : undefined) ??
    "text-muted-foreground";
  return <Icon aria-hidden="true" className={cn("size-4", colour)} />;
}
