"use client";

import { Loader2, LogIn } from "lucide-react";
import { useActionState, useState } from "react";
import { InitialsAvatar } from "@/components/initials-avatar";
import { cn } from "@/lib/utils";
import { type EnterAsState, enterAs } from "@/server/actions/auth";

/**
 * The three persona cards. Each is a form posting the persona's email to `enterAs`;
 * nobody types a password. The pressed card shows "Entering…" while the action runs.
 */
export type Persona = {
  email: string;
  name: string;
  roleLabel: string;
  lead: boolean;
};

export function LoginCards({ personas }: { personas: Persona[] }) {
  const [state, formAction, pending] = useActionState<EnterAsState, FormData>(
    enterAs,
    null,
  );
  const [pressed, setPressed] = useState<string | null>(null);
  const [lead, ...others] = personas;

  return (
    <div className="flex flex-col gap-4">
      {lead ? (
        <PersonaForm
          persona={lead}
          action={formAction}
          pending={pending && pressed === lead.email}
          onPress={() => setPressed(lead.email)}
          description="Superadmin · sees everything, can view as anyone"
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {others.map((persona) => (
          <PersonaForm
            key={persona.email}
            persona={persona}
            action={formAction}
            pending={pending && pressed === persona.email}
            onPress={() => setPressed(persona.email)}
            description={persona.roleLabel}
          />
        ))}
      </div>
      {state?.error ? (
        <p role="alert" className="text-caption text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

function PersonaForm({
  persona,
  description,
  action,
  pending,
  onPress,
}: {
  persona: Persona;
  description: string;
  action: (formData: FormData) => void;
  pending: boolean;
  onPress: () => void;
}) {
  const { lead } = persona;
  return (
    <form action={action} onSubmit={onPress}>
      <input type="hidden" name="email" value={persona.email} />
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "group flex w-full cursor-pointer items-center gap-4 rounded-lg border bg-card text-left transition-colors duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-default disabled:opacity-70",
          lead
            ? "border-primary p-5 hover:bg-primary-soft"
            : "border-border px-4 py-4 hover:border-muted-foreground",
        )}
      >
        <InitialsAvatar
          name={persona.name}
          size={lead ? "lg" : "md"}
          tone={lead ? "solid" : "soft"}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body-lg font-semibold text-foreground">
            {pending ? "Entering…" : `Enter as ${persona.name}`}
          </span>
          <span
            className={cn(
              "text-muted-foreground",
              lead ? "text-body" : "text-control font-normal",
            )}
          >
            {description}
          </span>
        </span>
        {lead ? (
          pending ? (
            <Loader2
              aria-hidden="true"
              className="size-5 animate-spin text-primary motion-reduce:animate-none"
            />
          ) : (
            <LogIn aria-hidden="true" className="size-5 text-primary" />
          )
        ) : null}
      </button>
    </form>
  );
}
