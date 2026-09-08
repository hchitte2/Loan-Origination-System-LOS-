import { desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { activity, loans, user } from "@/db/schema";
import {
  type ActivityAction,
  type ActivityFilter,
  type ActorKind,
  actionsForFilter,
  isActivityAction,
} from "@/lib/activity";
import type { Actor } from "../actor";
import { assertCan } from "../authz";

/**
 * The global activity log (PLAN.md §2 "Global activity log", superadmin only). Rows come
 * back with the names the Activity page needs to write its sentence; the page never
 * fetches more than it shows.
 */

export type ActivityRow = {
  id: number;
  action: ActivityAction;
  detail: Record<string, unknown>;
  actorKind: ActorKind;
  actorName: string | null;
  onBehalfOfName: string | null;
  loanId: string | null;
  /** "Chen · 412 Maple Ave", for the Loan column. */
  loanLabel: string | null;
  /** The borrower's name, which is who acted on public-link rows. */
  borrowerName: string | null;
  createdAt: Date;
};

export async function listGlobalActivity(
  actor: Actor,
  options: { filter?: ActivityFilter; limit?: number } = {},
): Promise<ActivityRow[]> {
  assertCan(actor, "admin.read_activity");
  const { filter = "all", limit = 100 } = options;
  const actorUser = alias(user, "actor_user");
  const behalfUser = alias(user, "behalf_user");
  const query = db()
    .select({
      id: activity.id,
      action: activity.action,
      detail: activity.detail,
      actorKind: activity.actorKind,
      actorName: actorUser.name,
      onBehalfOfName: behalfUser.name,
      loanId: activity.loanId,
      borrowerName: loans.borrowerName,
      propertyStreet: loans.propertyStreet,
      createdAt: activity.createdAt,
    })
    .from(activity)
    .leftJoin(actorUser, eq(actorUser.id, activity.actorId))
    .leftJoin(behalfUser, eq(behalfUser.id, activity.onBehalfOf))
    .leftJoin(loans, eq(loans.id, activity.loanId))
    .orderBy(desc(activity.createdAt), desc(activity.id))
    .limit(limit);
  const rows =
    filter === "all"
      ? await query
      : await query.where(
          inArray(activity.action, [...actionsForFilter(filter)]),
        );

  const result: ActivityRow[] = [];
  for (const row of rows) {
    // Only logActivity writes this column, so an unknown name is corruption, not a case to hide.
    if (!isActivityAction(row.action)) {
      throw new Error(
        `Activity row ${row.id} has an unknown action: ${row.action}`,
      );
    }
    result.push({
      id: row.id,
      action: row.action,
      detail: row.detail,
      actorKind: row.actorKind,
      actorName: row.actorName,
      onBehalfOfName: row.onBehalfOfName,
      loanId: row.loanId,
      loanLabel:
        row.borrowerName && row.propertyStreet
          ? `${row.borrowerName.split(" ").at(-1)} · ${row.propertyStreet}`
          : null,
      borrowerName: row.borrowerName,
      createdAt: row.createdAt,
    });
  }
  return result;
}
