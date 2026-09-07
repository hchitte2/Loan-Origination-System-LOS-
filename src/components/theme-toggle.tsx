"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Light / Dark / System segmented control (design-system skill: theme `sun` / `moon` /
 * `monitor`). next-themes persists the choice per browser and applies the class before
 * paint, so there is no flash on reload. Rendered as a radio group so the selection is
 * announced and arrow keys move between options.
 */

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

const subscribeNoop = () => () => {};

/** True after hydration; before that the server does not know the stored theme. */
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted ? (theme ?? "system") : null;

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={
              selected || (current === null && value === "system") ? 0 : -1
            }
            onClick={() => setTheme(value)}
            onKeyDown={(event) => {
              const index = OPTIONS.findIndex((o) => o.value === value);
              let next: number | null = null;
              if (event.key === "ArrowRight" || event.key === "ArrowDown")
                next = (index + 1) % OPTIONS.length;
              if (event.key === "ArrowLeft" || event.key === "ArrowUp")
                next = (index - 1 + OPTIONS.length) % OPTIONS.length;
              if (next === null) return;
              event.preventDefault();
              setTheme(OPTIONS[next].value);
              const buttons =
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                  "button",
                );
              buttons?.[next]?.focus();
            }}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-control transition-colors duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              selected
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
