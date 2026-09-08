import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isRole, type Role } from "@/lib/roles";
import { getAuth } from "./auth";

/**
 * Who is acting (PLAN.md §5 "Authorization and impersonation").
 *
 * `userId` and `role` describe the *effective* user, the one whose permissions apply.
 * `actorUserId` is the human at the keyboard: the same id normally, the superadmin's id
 * while impersonating. Authorization uses the effective user; the activity log records
 * both (`actor_id = actorUserId`, `on_behalf_of = impersonating ? userId : null`).
 */
export type Actor = {
  /** Effective user id. */
  userId: string;
  /** Effective role. */
  role: Role;
  name: string;
  email: string;
  /** The human who is signed in. Equals `userId` unless impersonating. */
  actorUserId: string;
  impersonating: boolean;
};

/** The current actor, or null when there is no valid session. */
export async function getActor(): Promise<Actor | null> {
  // Read the request first: on a static prerender `headers()` marks the route dynamic and
  // stops here, before `getAuth()` would demand the environment at build time.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { user } = session;
  if (!isRole(user.role)) {
    // The column is constrained to three values; anything else is corruption, not "no session".
    throw new Error(
      `User ${user.id} has an unknown role: ${String(user.role)}`,
    );
  }
  const impersonatedBy = session.session.impersonatedBy ?? null;
  return {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    actorUserId: impersonatedBy ?? user.id,
    impersonating: impersonatedBy !== null,
  };
}

/**
 * The current actor, or a redirect to /login. Call first in every layout, page, route
 * handler and Server Action; the proxy's cookie check is only an optimisation.
 */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}
