import { headers } from "next/headers";
import { db } from "@/db";
import { isRole } from "@/lib/roles";
import { logActivity } from "./activity";
import type { Actor } from "./actor";
import { getAuth } from "./auth";
import { assertCan } from "./authz";

/**
 * Ending an impersonation, in one place, so every path that can end one (the Exit
 * button, signing out, entering as another persona) records `admin.impersonation_ended`.
 * Not a "use server" module on purpose: it takes an `Actor` and must never be reachable
 * as an endpoint.
 */
export async function endImpersonation(actor: Actor): Promise<Actor> {
  if (!actor.impersonating) {
    throw new Error("endImpersonation called without an active impersonation.");
  }
  const restored = await getAuth().api.stopImpersonating({
    headers: await headers(),
  });
  const role = restored.user.role;
  if (!isRole(role)) {
    throw new Error(`Restored session has an unknown role: ${String(role)}`);
  }
  const superadmin: Actor = {
    userId: restored.user.id,
    role,
    name: restored.user.name,
    email: restored.user.email,
    actorUserId: restored.user.id,
    impersonating: false,
  };
  assertCan(superadmin, "admin.manage_users");
  await db().transaction(async (tx) => {
    await logActivity(tx, {
      actor: superadmin,
      action: "admin.impersonation_ended",
      detail: {
        target: actor.userId,
        targetName: actor.name,
        targetRole: actor.role,
      },
    });
  });
  return superadmin;
}
