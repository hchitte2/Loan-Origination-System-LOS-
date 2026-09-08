import { ShieldOff } from "lucide-react";
import Link from "next/link";
import { homeRoute } from "@/lib/roles";
import type { Actor } from "@/server/actor";
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
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6">
          <ShieldOff
            aria-hidden="true"
            className="size-5 text-muted-foreground"
          />
          <p className="text-body text-foreground">
            {what} is only for superadmins.
          </p>
          <p className="text-body text-muted-foreground">
            {actor.impersonating
              ? `You are viewing as ${actor.name}. Exit the view to open it.`
              : "Your role does not include it."}
          </p>
          <Link
            href={homeRoute(actor.role)}
            className={buttonVariants({ variant: "outline" })}
          >
            Go to your home
          </Link>
        </div>
      </div>
    </>
  );
}
