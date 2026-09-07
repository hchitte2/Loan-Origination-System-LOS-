import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Initials on a primary tint (16 % on card); the login's leading card uses solid primary.
 * Decorative: the name is always written next to it, so the avatar is hidden from
 * assistive technology.
 */
const SIZES = {
  xs: "size-5 text-[10px]",
  sm: "size-7 text-tag",
  md: "size-9 text-control",
  lg: "size-11 text-body font-semibold",
} as const;

export function InitialsAvatar({
  name,
  size = "sm",
  tone = "soft",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  tone?: "soft" | "solid";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium",
        tone === "solid"
          ? "bg-primary text-primary-foreground"
          : "bg-primary-avatar text-primary",
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
