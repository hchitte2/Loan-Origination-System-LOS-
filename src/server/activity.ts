import type { Tx } from "@/db";
import { activity } from "@/db/schema";
import type { ActivityAction, ActorKind } from "@/lib/activity";
import type { Actor } from "./actor";

/**
 * The only runtime writer of the `activity` table (PLAN.md §5 "Audit log"). Call it
 * inside the same transaction as the change it records, once per mutation. The table is
 * append-only by database trigger; nothing reads back to edit.
 *
 * `actor_id` is the human at the keyboard; `on_behalf_of` is the user they were viewing
 * as, if any. Public-link uploads and system events have no human.
 */
export type ActivityInput = {
  action: ActivityAction;
  loanId?: string | null;
  /** Only what the Activity tab needs to render its sentence. */
  detail?: Record<string, unknown>;
} & (
  | { actor: Actor; actorKind?: "user" }
  | { actor?: undefined; actorKind: Exclude<ActorKind, "user"> }
);

export async function logActivity(tx: Tx, input: ActivityInput): Promise<void> {
  const { actor, action, loanId = null, detail = {} } = input;
  await tx.insert(activity).values({
    loanId,
    action,
    detail,
    actorKind: actor ? "user" : input.actorKind,
    actorId: actor ? actor.actorUserId : null,
    onBehalfOf: actor?.impersonating ? actor.userId : null,
  });
}
