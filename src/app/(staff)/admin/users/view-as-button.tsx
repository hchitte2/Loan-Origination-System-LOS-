"use client";

import { Eye } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { startImpersonation } from "@/server/actions/admin";

/** "View as": a form posting the user id to startImpersonation, pending as "Opening…". */
export function ViewAsButton({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  return (
    <form action={startImpersonation}>
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton
        variant="outline"
        pendingLabel="Opening…"
        aria-label={`View as ${name}`}
      >
        <Eye aria-hidden="true" />
        View as
      </SubmitButton>
    </form>
  );
}
