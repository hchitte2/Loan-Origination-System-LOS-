import { ShieldOff } from "lucide-react";
import Link from "next/link";
import { homeRoute } from "@/lib/roles";
import type { Actor } from "@/server/actor";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";
import { buttonVariants } from "./ui/button";

/**
 * Rendered when a signed-in user opens a page their role may not see. While a superadmin
 * is viewing as someone, it says so: the admin pages come back once they exit the view.
 */
export function ForbiddenState({
  actor,
  what,
}: {
  actor: Actor;
  what: string;
}) {
  return (
    <>
      <PageHeader title="Not available" />
      <div className="px-6 pb-6">
        <EmptyState
          icon={ShieldOff}
          title={`${what} is only for superadmins.`}
          description={
            actor.impersonating
              ? `You are viewing as ${actor.name}. Exit the view to open it.`
              : "Your role does not include it."
          }
          action={
            <Link
              href={homeRoute(actor.role)}
              className={buttonVariants({ variant: "outline" })}
            >
              Go to your home
            </Link>
          }
        />
      </div>
    </>
  );
}
