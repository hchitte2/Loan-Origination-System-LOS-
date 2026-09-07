"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_USERS } from "@/db/demo-users";
import { getEnv } from "@/lib/env";
import { homeRoute } from "@/lib/roles";
import { getActor } from "../actor";
import { getAuth } from "../auth";
import { endImpersonation } from "../impersonation";
import { EnterAsSchema } from "./schemas";

/**
 * The login cards. Nobody types a password: each card names one of the three demo
 * accounts and the action signs in with DEMO_PASSWORD. Only card personas may be
 * entered this way; the other seeded staff are reached through "View as". An active
 * impersonation is ended (and logged) before the session changes hands.
 */

export type EnterAsState = { error: string } | null;

export async function enterAs(
  _previous: EnterAsState,
  formData: FormData,
): Promise<EnterAsState> {
  const parsed = EnterAsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Pick one of the demo accounts." };
  const persona = DEMO_USERS.find((u) => u.email === parsed.data.email);
  if (!persona) return { error: "Pick one of the demo accounts." };

  const requestHeaders = await headers();
  const current = await getActor();
  if (current?.impersonating) await endImpersonation(current);
  if (current) await getAuth().api.signOut({ headers: requestHeaders });

  try {
    await getAuth().api.signInEmail({
      body: { email: persona.email, password: getEnv().DEMO_PASSWORD },
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        error:
          "The demo accounts are not ready. If this is a fresh database, run the seed.",
      };
    }
    throw error;
  }
  redirect(homeRoute(persona.role));
}

export async function signOut(): Promise<void> {
  const actor = await getActor();
  if (actor?.impersonating) await endImpersonation(actor);
  if (actor) await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}
