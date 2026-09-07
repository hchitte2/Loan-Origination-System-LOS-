import { cn } from "@/lib/utils";

/**
 * The Clearline wordmark: the mark is a single stroke path (a line breaking into a
 * check) in `primary`, the name in Geist 600. 28 px on the login page, 17 px in the
 * sidebar (design-system skill, "Icons").
 */
export function Wordmark({
  size = "sidebar",
  className,
}: {
  size?: "login" | "sidebar";
  className?: string;
}) {
  const login = size === "login";
  return (
    <span
      className={cn(
        "inline-flex items-center font-display font-semibold text-foreground",
        login ? "gap-3 text-wordmark" : "gap-2 text-[17px] leading-6",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("text-primary", login ? "size-8" : "size-5")}
      >
        <path d="M2 14h8l3 4 9-12" />
      </svg>
      Clearline
    </span>
  );
}
