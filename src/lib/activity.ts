/**
 * Audit-log vocabulary (PLAN.md §5 "Audit log", §6 "Action names"). `src/db/schema.ts`
 * builds the `actor_kind` enum from `ACTOR_KINDS`; `src/server/activity.ts` accepts only
 * the action names listed here, and the Activity page groups them into its filter chips.
 */

/** Who performed a mutation: a signed-in human, the borrower via the public link, or the system. */
export const ACTOR_KINDS = ["user", "public_link", "system"] as const;

export type ActorKind = (typeof ACTOR_KINDS)[number];

export const ACTIVITY_ACTIONS = [
  "loan.created",
  "loan.updated",
  "loan.stage_changed",
  "loan.link_regenerated",
  "condition.created",
  "condition.updated",
  "condition.cleared",
  "condition.waived",
  "condition.deleted",
  "document.uploaded",
  "document.accepted",
  "document.rejected",
  "admin.user_created",
  "admin.impersonation_started",
  "admin.impersonation_ended",
  "demo.reset",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export function isActivityAction(value: unknown): value is ActivityAction {
  return (
    typeof value === "string" &&
    (ACTIVITY_ACTIONS as readonly string[]).includes(value)
  );
}

/** Filter chips on the superadmin Activity page, in display order. */
export const ACTIVITY_FILTERS = [
  "all",
  "stage_changes",
  "documents",
  "conditions",
  "users",
  "impersonation",
  "resets",
] as const;

export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

const FILTER_LABELS = {
  all: "All",
  stage_changes: "Stage changes",
  documents: "Documents",
  conditions: "Conditions",
  users: "Users",
  impersonation: "Impersonation",
  resets: "Resets",
} as const satisfies Record<ActivityFilter, string>;

export function activityFilterLabel(filter: ActivityFilter): string {
  return FILTER_LABELS[filter];
}

export function isActivityFilter(value: unknown): value is ActivityFilter {
  return (
    typeof value === "string" &&
    (ACTIVITY_FILTERS as readonly string[]).includes(value)
  );
}

/** Which actions each filter chip shows; `all` shows everything. */
export function actionsForFilter(
  filter: ActivityFilter,
): readonly ActivityAction[] {
  switch (filter) {
    case "all":
      return ACTIVITY_ACTIONS;
    case "stage_changes":
      return ["loan.stage_changed"];
    case "documents":
      return ["document.uploaded", "document.accepted", "document.rejected"];
    case "conditions":
      return [
        "condition.created",
        "condition.updated",
        "condition.cleared",
        "condition.waived",
        "condition.deleted",
      ];
    case "users":
      return ["admin.user_created"];
    case "impersonation":
      return ["admin.impersonation_started", "admin.impersonation_ended"];
    case "resets":
      return ["demo.reset"];
  }
}
