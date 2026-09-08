import {
  Activity,
  Inbox,
  Kanban,
  LayoutDashboard,
  type LucideIcon,
  Users,
} from "lucide-react";
import type { Role } from "@/lib/roles";

/**
 * Sidebar navigation per role (design-system skill, "Page skeletons"). The effective
 * role decides, so a superadmin viewing as Sam sees exactly Sam's navigation and the
 * admin entries disappear until they exit the view.
 */
export type NavItem = { href: string; label: string; icon: LucideIcon };

const ITEMS = {
  dashboard: { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  pipeline: { href: "/pipeline", label: "Pipeline", icon: Kanban },
  queue: { href: "/queue", label: "Queue", icon: Inbox },
  users: { href: "/admin/users", label: "Users", icon: Users },
  activity: { href: "/admin/activity", label: "Activity", icon: Activity },
} satisfies Record<string, NavItem>;

const NAV: Record<Role, NavItem[]> = {
  superadmin: [
    ITEMS.dashboard,
    ITEMS.pipeline,
    ITEMS.queue,
    ITEMS.users,
    ITEMS.activity,
  ],
  loan_officer: [ITEMS.pipeline, ITEMS.dashboard],
  processor: [ITEMS.queue],
};

export function navFor(role: Role): NavItem[] {
  return NAV[role];
}

/** Whether `pathname` sits under one of the role's navigation entries. */
export function isNavRoute(role: Role, pathname: string): boolean {
  return NAV[role].some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
