import {
  ArrowRight,
  CircleCheck,
  CircleMinus,
  CircleX,
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

const ICONS: Record<ActivityAction, LucideIcon> = {
  "loan.created": Plus,
  "loan.updated": Pencil,
  "loan.stage_changed": ArrowRight,
  "loan.link_regenerated": Link2,
  "condition.created": Plus,
  "condition.updated": Pencil,
  "condition.cleared": CircleCheck,
  "condition.waived": CircleMinus,
  "condition.deleted": Trash2,
  "document.uploaded": Upload,
  "document.accepted": CircleCheck,
  "document.rejected": CircleX,
  "admin.user_created": Users,
  "admin.impersonation_started": Eye,
  "admin.impersonation_ended": Eye,
  "demo.reset": RotateCcw,
};

/** The 16 px lucide icon for an activity row; decorative, the sentence says it all. */
export function ActivityIcon({ action }: { action: ActivityAction }) {
  const Icon = ICONS[action];
  return <Icon aria-hidden="true" className="size-4 text-muted-foreground" />;
}
