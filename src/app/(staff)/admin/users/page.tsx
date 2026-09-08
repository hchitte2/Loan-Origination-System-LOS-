import type { Metadata } from "next";
import { ForbiddenState } from "@/components/forbidden-state";
import { InitialsAvatar } from "@/components/initials-avatar";
import { PageHeader } from "@/components/page-header";
import { RolePill } from "@/components/role-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelative } from "@/lib/format";
import { requireActor } from "@/server/actor";
import { can } from "@/server/authz";
import { listUsers } from "@/server/queries/users";
import { CreateUserDialog } from "./create-user-dialog";
import { ViewAsButton } from "./view-as-button";

export const metadata: Metadata = { title: "Users" };

/**
 * Superadmin only (design frame 07-users): the staff list with role, email, active loans,
 * last activity and "View as" on everyone but yourself and other superadmins. While
 * viewing as someone the effective role is theirs, so the page explains and steps aside.
 */
export default async function UsersPage() {
  const actor = await requireActor();
  if (!can(actor, "admin.manage_users")) {
    return <ForbiddenState actor={actor} what="The Users page" />;
  }
  const users = await listUsers(actor);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Users"
        description='"View as" shows you exactly what that person sees. Everything you do while viewing is logged under your name.'
        action={<CreateUserDialog />}
      />
      <div className="px-6 pb-6">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-muted">
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Loans assigned</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="w-px">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const self = user.id === actor.userId;
                const viewable = !self && user.role !== "superadmin";
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <InitialsAvatar name={user.name} size="sm" />
                        <span className="font-medium text-foreground">
                          {user.name}
                        </span>
                        {self ? (
                          <span className="text-muted-foreground">· you</span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <RolePill role={user.role} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {user.loansAssigned > 0 ? (
                        user.loansAssigned
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.lastActiveAt
                        ? formatRelative(user.lastActiveAt, now)
                        : "—"}
                    </TableCell>
                    <TableCell className="py-1">
                      {viewable ? (
                        <ViewAsButton userId={user.id} name={user.name} />
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
