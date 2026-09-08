import { ImpersonationBanner } from "@/components/impersonation-banner";
import { SkipLink } from "@/components/skip-link";
import { StaffSidebar } from "@/components/staff/sidebar";
import { requireActor } from "@/server/actor";

/**
 * The staff shell (PLAN.md §5, design-system skill "Page skeletons"): session check,
 * skip link, the impersonation banner when viewing as someone, the sidebar, and the
 * content column. Every page under it calls requireActor() again on purpose.
 */
export default async function StaffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await requireActor();
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SkipLink />
      {actor.impersonating ? <ImpersonationBanner actor={actor} /> : null}
      <div className="flex min-h-0 flex-1">
        <StaffSidebar actor={actor} />
        <main id="main" className="min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
