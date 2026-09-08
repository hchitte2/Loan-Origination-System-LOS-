"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { homeRoute, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { isNavRoute, navFor } from "./nav";

/**
 * Role navigation; the active item is `primary` on a 10 % primary tint. A route that is
 * not itself in the nav — a loan detail, the new loan page — lights the role's home
 * instead, so the shell never looks like it belongs nowhere.
 */
export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const fallback = isNavRoute(role, pathname) ? null : homeRoute(role);
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 px-4">
      {navFor(role).map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          fallback === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-3 rounded-lg px-3 text-body font-medium transition-colors duration-150 ease-out motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              active
                ? "bg-primary-soft text-primary"
                : "text-foreground hover:bg-muted",
            )}
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
