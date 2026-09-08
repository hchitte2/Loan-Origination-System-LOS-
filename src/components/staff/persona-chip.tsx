"use client";

import { ChevronsUpDown, LogOut } from "lucide-react";
import { InitialsAvatar } from "@/components/initials-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type Role, roleLabel } from "@/lib/roles";
import { signOut } from "@/server/actions/auth";
import { Button } from "../ui/button";

/**
 * The persona chip at the bottom of the sidebar: a 44 px bordered button with the
 * effective user's initials, name and role. Its menu holds the theme control and
 * "Sign out". While impersonating it shows the target user, as the design specifies.
 */
export function PersonaChip({ name, role }: { name: string; role: Role }) {
  return (
    <Popover>
      <PopoverTrigger
        className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-2 text-left transition-colors duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none"
        aria-label={`${name}, ${roleLabel(role)}. Account menu`}
      >
        <InitialsAvatar name={name} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-control text-foreground">{name}</span>
          <span className="truncate text-caption text-muted-foreground">
            {roleLabel(role)}
          </span>
        </span>
        <ChevronsUpDown
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-menu gap-3 p-3"
      >
        <div className="flex flex-col gap-2">
          <span className="text-caption text-muted-foreground">Theme</span>
          <ThemeToggle className="w-full justify-between" />
        </div>
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start"
          >
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
