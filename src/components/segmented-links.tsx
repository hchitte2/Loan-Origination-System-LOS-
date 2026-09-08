import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A segmented control whose segments are links, because the choice lives in the URL and
 * the server does the filtering (design frame 02-pipeline: Mine/All and Board/List).
 * A labelled `nav` is the honest element — following a segment navigates — and the
 * selected one is a raised `card` chip carrying `aria-current`, so the state is
 * announced and not only shown.
 */
export type Segment = {
  href: string;
  label: string;
  icon?: LucideIcon;
  current: boolean;
};

export function SegmentedLinks({
  label,
  segments,
}: {
  label: string;
  segments: Segment[];
}) {
  return (
    <nav
      aria-label={label}
      className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5"
    >
      {segments.map((segment) => (
        <Link
          key={segment.href}
          href={segment.href}
          aria-current={segment.current ? "page" : undefined}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-control outline-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
            segment.current
              ? "bg-card text-foreground shadow-card"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {segment.icon ? (
            <segment.icon aria-hidden="true" className="size-4" />
          ) : null}
          {segment.label}
        </Link>
      ))}
    </nav>
  );
}
