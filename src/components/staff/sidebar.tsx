import { DemoBadge } from "@/components/demo-badge";
import { Wordmark } from "@/components/wordmark";
import type { Actor } from "@/server/actor";
import { PersonaChip } from "./persona-chip";
import { SidebarNav } from "./sidebar-nav";

/** 240 px on `card` with a right hairline: wordmark row, role nav, persona chip, demo badge. */
export function StaffSidebar({ actor }: { actor: Actor }) {
  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center px-6">
        <Wordmark size="sidebar" />
      </div>
      <SidebarNav role={actor.role} />
      <div className="mt-auto flex flex-col items-start gap-3 p-4">
        <PersonaChip name={actor.name} role={actor.role} />
        <DemoBadge />
      </div>
    </aside>
  );
}
