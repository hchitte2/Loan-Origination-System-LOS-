import { z } from "zod";
import { DEMO_USERS } from "@/db/demo-users";
import { ROLES } from "@/lib/roles";

/**
 * Input schemas shared by Server Actions and the forms that call them. They live beside
 * the actions rather than inside them because a "use server" module may export only
 * async functions.
 */

const CARD_EMAILS = DEMO_USERS.filter((u) => u.card).map((u) => u.email);

export const EnterAsSchema = z.object({
  email: z.email().refine((email) => CARD_EMAILS.includes(email), {
    message: "That account has no login card.",
  }),
});

export const ImpersonateSchema = z.object({
  userId: z.string().trim().min(1).max(200),
});

export const CreateUserSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's name.").max(80),
  email: z
    .email("Enter a full email address, like jamie@example.com.")
    .trim()
    .toLowerCase()
    .refine((email) => email.endsWith("@example.com"), {
      message: "Demo accounts use @example.com addresses.",
    }),
  role: z.enum(ROLES, { message: "Choose a role." }),
});

export type CreateUserField = keyof z.infer<typeof CreateUserSchema>;
