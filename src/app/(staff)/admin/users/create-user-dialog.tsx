"use client";

import { CircleAlert, Plus } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES, type Role, roleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { type CreateUserState, createUser } from "@/server/actions/admin";

/**
 * "Create user" (design frame 07-users): a 440 px dialog with Name, Email (with the
 * demo note) and Role. Errors sit under their field; success closes the dialog and
 * announces a toast. The action re-checks authorization; the dialog is not the control.
 */
export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("loan_officer");
  const ids = {
    name: useId(),
    email: useId(),
    role: useId(),
    emailHelp: useId(),
  };
  const [state, formAction, pending] = useActionState<
    CreateUserState,
    FormData
  >(async (previous, formData) => {
    const result = await createUser(previous, formData);
    if (result?.ok) {
      setOpen(false);
      setRole("loan_officer");
      toast.success(`${result.name} added · ${roleLabel(result.role)}.`);
      return null;
    }
    return result;
  }, null);
  const errors = state && !state.ok ? state.errors : {};
  const formError = state && !state.ok ? state.error : undefined;
  // React resets an uncontrolled form after its action runs; the echoed values keep what
  // the user typed while they fix the one field that failed.
  const values = state && !state.ok ? state.values : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus aria-hidden="true" />
        Create user
      </DialogTrigger>
      <DialogContent className="sm:max-w-dialog-sm">
        <form action={formAction} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription className="sr-only">
              Add a staff account to the demo. Open it from this list with View
              as.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field id={ids.name} label="Name" error={errors.name}>
              <Input
                id={ids.name}
                name="name"
                autoComplete="off"
                defaultValue={values.name}
                required
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? `${ids.name}-error` : undefined}
              />
            </Field>
            <Field
              id={ids.email}
              label="Email"
              error={errors.email}
              help="Demo accounts use @example.com. Nobody types a password."
              helpId={ids.emailHelp}
            >
              <Input
                id={ids.email}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                defaultValue={values.email}
                required
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={cn(
                  ids.emailHelp,
                  errors.email && `${ids.email}-error`,
                )}
              />
            </Field>
            <Field id={ids.role} label="Role" error={errors.role}>
              <Select
                name="role"
                value={role}
                onValueChange={(value) => value && setRole(value as Role)}
              >
                <SelectTrigger
                  id={ids.role}
                  className="w-full"
                  aria-invalid={errors.role ? true : undefined}
                >
                  <SelectValue>{roleLabel(role)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {roleLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {formError ? (
              <p
                role="alert"
                className="flex items-center gap-1.5 text-caption text-destructive"
              >
                <CircleAlert aria-hidden="true" className="size-4" />
                {formError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <SubmitButton pendingLabel="Creating…" disabled={pending}>
              Create user
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  help,
  helpId,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  help?: string;
  helpId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help ? (
        <p id={helpId} className="text-caption text-muted-foreground">
          {help}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1.5 text-caption text-destructive"
        >
          <CircleAlert aria-hidden="true" className="size-4" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
