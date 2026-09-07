/**
 * Login roles (PLAN.md §2). Stored as text on `user.role`; `src/server/authz.ts` keys
 * its policy table by these values. The borrower has no role because there is no
 * borrower account.
 */

export const ROLES = ["loan_officer", "processor", "superadmin"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

const ROLE_LABELS = {
  loan_officer: "Loan officer",
  processor: "Processor",
  superadmin: "Superadmin",
} as const satisfies Record<Role, string>;

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

/** Where a role lands after login. */
const HOME_ROUTES = {
  loan_officer: "/pipeline",
  processor: "/queue",
  superadmin: "/dashboard",
} as const satisfies Record<Role, string>;

export function homeRoute(role: Role): string {
  return HOME_ROUTES[role];
}
