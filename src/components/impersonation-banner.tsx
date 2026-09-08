import { Eye } from "lucide-react";
import { roleLabel } from "@/lib/roles";
import { stopImpersonation } from "@/server/actions/admin";
import type { Actor } from "@/server/actor";
import { ExitViewButton } from "./staff/exit-view-button";

/**
 * Fixed 40 px bar above everything while a superadmin views as someone (PLAN.md §5):
 * amber with dark text in both themes, `role="status"`, "Viewing as Sam Okafor ·
 * Processor", and a real Exit button that is the next tab stop after the skip link.
 */
export function ImpersonationBanner({ actor }: { actor: Actor }) {
  return (
    <div
      role="status"
      className="flex h-banner shrink-0 items-center justify-between gap-4 bg-banner px-4 text-banner-foreground"
    >
      <span className="flex items-center gap-2 text-body font-medium">
        <Eye aria-hidden="true" className="size-4" />
        Viewing as {actor.name} · {roleLabel(actor.role)}
      </span>
      <form action={stopImpersonation}>
        <ExitViewButton />
      </form>
    </div>
  );
}
