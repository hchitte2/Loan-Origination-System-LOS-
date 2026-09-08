"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { getEnv } from "@/lib/env";
import { homeRoute } from "@/lib/roles";
import { logActivity } from "../activity";
import { requireActor } from "../actor";
import { getAuth } from "../auth";
import { assertCan } from "../authz";
import { endImpersonation } from "../impersonation";
import { getUserSummary } from "../queries/users";
import {
  type CreateUserField,
  CreateUserSchema,
  ImpersonateSchema,
} from "./schemas";

/**
 * Superadmin actions (PLAN.md §2 "Users list, create user, impersonate"; §5
 * "Authorization and impersonation"). Each one re-checks the actor, calls the Better Auth
 * admin API with the request headers, and writes its activity row in the same request.
 * Better Auth's own writes cannot share our transaction, so a failed activity insert is
 * compensated by undoing the auth-side change before the error propagates.
 */

/**
 * Begin viewing as another user. The activity row is written by the superadmin. Better
 * Auth refuses targets that are themselves superadmins.
 */
export async function startImpersonation(formData: FormData): Promise<void> {
  const { userId } = ImpersonateSchema.parse(Object.fromEntries(formData));
  const actor = await requireActor();
  assertCan(actor, "admin.manage_users");
  if (actor.impersonating) {
    throw new Error("Exit the current view before viewing as someone else.");
  }
  const target = await getUserSummary(actor, userId);
  if (!target) throw new Error("That user does not exist.");

  const requestHeaders = await headers();
  await getAuth().api.impersonateUser({
    body: { userId: target.id },
    headers: requestHeaders,
  });
  try {
    await db().transaction(async (tx) => {
      await logActivity(tx, {
        actor,
        action: "admin.impersonation_started",
        detail: {
          target: target.id,
          targetName: target.name,
          targetRole: target.role,
        },
      });
    });
  } catch (error) {
    await getAuth().api.stopImpersonating({ headers: requestHeaders });
    throw error;
  }
  revalidatePath("/", "layout");
  redirect(homeRoute(target.role));
}

/** The banner's "Exit view": restore the superadmin's own session and record who was viewed. */
export async function stopImpersonation(): Promise<void> {
  const actor = await requireActor();
  if (!actor.impersonating) redirect(homeRoute(actor.role));
  await endImpersonation(actor);
  revalidatePath("/", "layout");
  redirect("/admin/users");
}

/** What the user typed, echoed back so the form keeps it after a failed submit. */
export type CreateUserValues = Partial<Record<CreateUserField, string>>;

export type CreateUserState =
  | { ok: true; name: string }
  | {
      ok: false;
      errors: Partial<Record<CreateUserField, string>>;
      error?: string;
      values: CreateUserValues;
    }
  | null;

function submittedValues(formData: FormData): CreateUserValues {
  const read = (key: CreateUserField) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };
  return { name: read("name"), email: read("email"), role: read("role") };
}

/** Create a staff account with the shared demo password; superadmin only. */
export async function createUser(
  _previous: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const parsed = CreateUserSchema.safeParse(Object.fromEntries(formData));
  const values = submittedValues(formData);
  if (!parsed.success) {
    const errors: Partial<Record<CreateUserField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        (field === "name" || field === "email" || field === "role") &&
        !errors[field]
      ) {
        errors[field] = issue.message;
      }
    }
    return { ok: false, errors, values };
  }
  const actor = await requireActor();
  assertCan(actor, "admin.manage_users");
  const { name, email, role } = parsed.data;

  const requestHeaders = await headers();
  let createdId: string;
  try {
    const result = await getAuth().api.createUser({
      body: { name, email, role, password: getEnv().DEMO_PASSWORD },
      headers: requestHeaders,
    });
    createdId = result.user.id;
  } catch (error) {
    if (error instanceof APIError) {
      const message = /already exists/i.test(error.message)
        ? "Someone already has that email address."
        : "Could not create the user.";
      return { ok: false, errors: {}, error: message, values };
    }
    throw error;
  }
  try {
    await db().transaction(async (tx) => {
      await logActivity(tx, {
        actor,
        action: "admin.user_created",
        detail: { userId: createdId, name, role },
      });
    });
  } catch (error) {
    await getAuth().api.removeUser({
      body: { userId: createdId },
      headers: requestHeaders,
    });
    throw error;
  }
  revalidatePath("/admin/users");
  return { ok: true, name };
}
