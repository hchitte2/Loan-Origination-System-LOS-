import { and, eq, inArray, max, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { loans, session, user } from "@/db/schema";
import { isRole, type Role } from "@/lib/roles";
import { ACTIVE_STAGES } from "@/lib/stages";
import type { Actor } from "../actor";
import { assertCan } from "../authz";

/**
 * Superadmin reads of the staff list (PLAN.md §2 "Users list"). Every query takes the
 * actor and authorizes itself; no query returns rows the caller may not see.
 */

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  nmlsId: string | null;
  phone: string | null;
  /** Active loans where this user is the loan officer or the processor. */
  loansAssigned: number;
  /** Most recent session activity, or null if they never signed in. */
  lastActiveAt: Date | null;
  createdAt: Date;
};

export async function listUsers(actor: Actor): Promise<UserRow[]> {
  assertCan(actor, "admin.manage_users");
  const activeLoans = db()
    .select({
      userId: sql<string>`u.id`.as("user_id"),
      n: sql<number>`count(*)::int`.as("n"),
    })
    .from(sql`${user} as u`)
    .innerJoin(
      loans,
      and(
        or(
          eq(loans.loanOfficerId, sql`u.id`),
          eq(loans.processorId, sql`u.id`),
        ),
        inArray(loans.stage, [...ACTIVE_STAGES]),
      ),
    )
    .groupBy(sql`u.id`)
    .as("active_loans");
  const lastActive = db()
    .select({
      userId: session.userId,
      at: max(session.updatedAt).as("at"),
    })
    .from(session)
    .groupBy(session.userId)
    .as("last_active");

  const rows = await db()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      nmlsId: user.nmlsId,
      phone: user.phone,
      loansAssigned: sql<number>`coalesce(${activeLoans.n}, 0)`,
      lastActiveAt: lastActive.at,
      createdAt: user.createdAt,
    })
    .from(user)
    .leftJoin(activeLoans, eq(activeLoans.userId, user.id))
    .leftJoin(lastActive, eq(lastActive.userId, user.id))
    .orderBy(user.createdAt);

  return rows.map((row) => {
    if (!isRole(row.role)) {
      throw new Error(
        `User ${row.id} has an unknown role: ${String(row.role)}`,
      );
    }
    return { ...row, role: row.role };
  });
}

export type UserSummary = { id: string; name: string; role: Role };

/** One user by id, for the impersonation actions; null when missing or malformed. */
export async function getUserSummary(
  actor: Actor,
  id: string,
): Promise<UserSummary | null> {
  assertCan(actor, "admin.manage_users");
  const [row] = await db()
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  if (!row || !isRole(row.role)) return null;
  return { id: row.id, name: row.name, role: row.role };
}
