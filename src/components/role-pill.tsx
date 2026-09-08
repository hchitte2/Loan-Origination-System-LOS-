import { Briefcase, ClipboardCheck, Shield } from "lucide-react";
import { type Role, roleLabel } from "@/lib/roles";
import { Pill } from "./pill";

/** Superadmin on a primary tint with `shield`; loan officer and processor on muted. */
export function RolePill({ role }: { role: Role }) {
  switch (role) {
    case "superadmin":
      return (
        <Pill tone="primary" icon={Shield}>
          {roleLabel(role)}
        </Pill>
      );
    case "loan_officer":
      return <Pill icon={Briefcase}>{roleLabel(role)}</Pill>;
    case "processor":
      return <Pill icon={ClipboardCheck}>{roleLabel(role)}</Pill>;
  }
}
