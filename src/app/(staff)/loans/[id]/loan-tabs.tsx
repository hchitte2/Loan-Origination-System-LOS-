"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Overview · Needs list · Activity (design frame 03-loan-detail): each tab is a route, so
 * they are links with a 2 px `primary` underline on the active one. `aria-current` says
 * which is open; a tablist role would be a lie about links that navigate.
 */
export function LoanTabs({ loanId }: { loanId: string }) {
  const pathname = usePathname();
  const base = `/loans/${loanId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/needs-list`, label: "Needs list" },
    { href: `${base}/activity`, label: "Activity" },
  ];
  return (
    <nav
      aria-label="Loan sections"
      className="-mb-px flex gap-4 border-b border-border"
    >
      {tabs.map((tab) => {
        const current = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center border-b-2 px-1 text-control outline-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              current
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
