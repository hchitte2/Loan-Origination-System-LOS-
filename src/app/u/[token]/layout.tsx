import { Phone } from "lucide-react";
import type { Metadata } from "next";
import { DemoNotice } from "@/components/public/demo-notice";
import { SkipLink } from "@/components/skip-link";
import { Wordmark } from "@/components/wordmark";
import { getPublicLoanView } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Your loan",
  // Belt and braces over the root layout: nothing on a tokenized page is ever indexed.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The borrower's shell (design frames 05-public-*; design-system skill "Public shell").
 *
 * No session, no sidebar, no navigation: one column, the loan officer's name and number
 * within reach at the top, and the demo notice at the foot of every render. The top bar
 * needs the officer, so it resolves the token itself — the page resolves it again, which
 * costs one cached query and keeps each file honest about what it depends on.
 */
export default async function PublicLayout({
  children,
  params,
}: LayoutProps<"/u/[token]">) {
  const { token } = await params;
  const view = await getPublicLoanView(token);

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="border-border border-b bg-card">
        <div className="mx-auto flex max-w-public flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Wordmark />
          {view ? (
            <p className="flex items-center gap-2 text-public text-muted-foreground">
              <Phone aria-hidden="true" className="size-4 shrink-0" />
              <span>
                Your loan officer:{" "}
                <span className="font-medium text-foreground">
                  {view.loanOfficer.name}
                </span>
                {view.loanOfficer.phone ? (
                  <>
                    {" · "}
                    <a
                      href={`tel:${view.loanOfficer.phone.replace(/[^\d+]/g, "")}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {view.loanOfficer.phone}
                    </a>
                  </>
                ) : null}
              </span>
            </p>
          ) : null}
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-public flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="px-4 py-6">
        <DemoNotice />
      </footer>
    </div>
  );
}
