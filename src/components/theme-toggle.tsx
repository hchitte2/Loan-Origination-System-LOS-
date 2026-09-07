"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useId, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Light / Dark / System segmented control (design-system skill: theme `sun` / `moon` /
 * `monitor`). Real radio inputs, so the group is announced and arrow keys move the
 * selection. next-themes persists the choice per browser and applies the class before
 * paint, so there is no flash on reload.
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
  const name = useId();
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <fieldset
      className={cn(
        "inline-flex h-8 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5",
        className,
      )}
    >
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map(({ value, label, Icon }) => (
        <label
          key={value}
          className={cn(
            "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-control transition-colors duration-150 ease-out motion-reduce:transition-none",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card",
            "has-[:checked]:bg-muted has-[:checked]:text-foreground",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <input
            type="radio"
            name={name}
            value={value}
            checked={current === value}
            onChange={() => setTheme(value)}
            className="sr-only"
          />
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
