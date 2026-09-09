import type { ActivityAction, ActorKind } from "./activity";
import { isRole, roleLabel } from "./roles";
import {
  closedReasonLabel,
  isClosedReason,
  isStage,
  staffLabel,
} from "./stages";

/**
 * Turns an activity row into the sentence the Activity tab and the global log show:
 * "Priya Nair (viewing as Sam Okafor)" + "rejected paystubs.pdf: pages are cut off".
 * Pure, so it is unit-testable and the same on both surfaces.
 */
export type ActivityLike = {
  action: ActivityAction;
  detail: Record<string, unknown>;
  actorKind: ActorKind;
  actorName: string | null;
  onBehalfOfName: string | null;
  borrowerName: string | null;
};

function text(detail: Record<string, unknown>, key: string): string | null {
  const value = detail[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Who acted, as the log names them. */
export function activityActor(row: ActivityLike): string {
  switch (row.actorKind) {
    case "system":
      return "System";
    case "public_link":
      return row.borrowerName ?? "The borrower";
    case "user": {
      const name = row.actorName ?? "Someone";
      return row.onBehalfOfName
        ? `${name} (viewing as ${row.onBehalfOfName})`
        : name;
    }
  }
}

/** What they did, without the actor. */
export function activityText(row: ActivityLike): string {
  const { detail } = row;
  const withReason = (base: string, key = "reason") => {
    const reason = text(detail, key);
    return reason ? `${base}: ${reason}` : base;
  };
  switch (row.action) {
    case "loan.created":
      return "created the loan";
    case "loan.updated":
      return "updated the loan";
    case "loan.stage_changed": {
      const from = detail.from;
      const to = detail.to;
      const fromLabel = isStage(from) ? staffLabel(from) : "its previous stage";
      const toLabel = isStage(to) ? staffLabel(to) : "a new stage";
      const moved = `moved the loan from ${fromLabel} to ${toLabel}`;
      // Withdrawn and denied always carry a closed reason and only sometimes a note, so
      // the reason stands in when nobody typed one; otherwise the log says why the file
      // ended without saying why.
      const closed = detail.closedReason;
      if (!text(detail, "reason") && isClosedReason(closed)) {
        return `${moved}: ${closedReasonLabel(closed).toLowerCase()}`;
      }
      return withReason(moved);
    }
    case "loan.link_regenerated":
      return "regenerated the borrower link";
    case "loan.link_copied":
      return "copied the borrower link";
    case "condition.created":
      return `added ${text(detail, "title") ?? "a condition"}`;
    case "condition.updated":
      return `edited ${text(detail, "title") ?? "a condition"}`;
    case "condition.cleared":
      return `cleared ${text(detail, "title") ?? "a condition"}`;
    case "condition.waived":
      return withReason(`waived ${text(detail, "title") ?? "a condition"}`);
    case "condition.deleted":
      return `removed ${text(detail, "title") ?? "a condition"}`;
    case "document.uploaded": {
      const file = text(detail, "fileName") ?? "a document";
      return row.actorKind === "public_link"
        ? `uploaded ${file} via the borrower link`
        : `uploaded ${file}`;
    }
    case "document.accepted":
      return `accepted ${text(detail, "fileName") ?? "a document"}`;
    case "document.rejected":
      return withReason(`rejected ${text(detail, "fileName") ?? "a document"}`);
    case "admin.user_created": {
      const name = text(detail, "name") ?? "a user";
      const role = detail.role;
      return isRole(role)
        ? `created user ${name} · ${roleLabel(role)}`
        : `created user ${name}`;
    }
    case "admin.impersonation_started":
      return `started viewing as ${text(detail, "targetName") ?? "a user"}`;
    case "admin.impersonation_ended":
      return `stopped viewing as ${text(detail, "targetName") ?? "a user"}`;
    case "demo.reset":
      return "reset demo data";
  }
}
