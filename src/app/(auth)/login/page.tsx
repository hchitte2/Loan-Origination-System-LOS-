import { Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DemoBadge } from "@/components/demo-badge";
import { SkipLink } from "@/components/skip-link";
import { Wordmark } from "@/components/wordmark";
import { DEMO_USERS } from "@/db/demo-users";
import { getEnv } from "@/lib/env";
import { homeRoute, roleLabel } from "@/lib/roles";
import { getActor } from "@/server/actor";
import { LoginCards, type Persona } from "./login-cards";

export const metadata: Metadata = { title: "Enter the demo" };

/**
 * The front door (PLAN.md §2, design frame 01): "Enter as Priya Nair" leads, Alex and
 * Sam follow, then the borrower link and a three-line tour. Nobody types a password.
 * A signed-in visitor is sent to their home instead.
 */
export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect(homeRoute(actor.role));

  const personas: Persona[] = DEMO_USERS.filter((u) => u.card).map((u) => ({
    email: u.email,
    name: u.name,
    roleLabel: roleLabel(u.role),
    lead: u.role === "superadmin",
  }));
  const borrowerHref = `/u/${getEnv().DEMO_SHOWCASE_TOKEN}`;

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <SkipLink />
      <aside aria-label="Demo notice" className="absolute top-6 right-6">
        <DemoBadge />
      </aside>
      <main
        id="main"
        className="mx-auto flex w-full max-w-login flex-1 flex-col justify-center gap-8 px-4 py-24"
      >
        <header className="flex flex-col items-center gap-3 text-center">
          <h1>
            <Wordmark size="login" />
          </h1>
          <p className="text-body-lg text-muted-foreground">
            A demo loan origination system
          </p>
        </header>

        <LoginCards personas={personas} />

        <div className="-my-4 flex items-center gap-4" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-caption text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <a
          href={borrowerHref}
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-primary bg-card px-4 text-body-lg transition-colors motion-reduce:transition-none duration-150 ease-out hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Smartphone aria-hidden="true" className="size-4 text-primary" />
          <span className="font-semibold text-primary">
            Try the borrower experience
          </span>
          <span className="text-muted-foreground">
            · opens Maria's upload link
          </span>
        </a>

        <ol className="flex flex-col gap-2 rounded-lg bg-muted px-5 py-4 text-body-lg text-muted-foreground">
          {[
            "Enter as Priya.",
            "Open Users and view as Alex or Sam.",
            "Open the borrower link on your phone and upload a file.",
          ].map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="w-5 shrink-0 font-semibold text-foreground tabular-nums">
                {index + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </main>
      <footer className="px-4 pb-10 text-center text-body text-muted-foreground">
        Demo system with synthetic data. Do not upload real personal documents.
      </footer>
    </div>
  );
}
