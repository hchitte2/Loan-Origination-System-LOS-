import { z } from "zod";
import { DEMO_USERS } from "@/db/demo-users";
import {
  ADDRESS_EXAMPLE,
  ADDRESS_MAX_LENGTH,
  parseAddress,
} from "@/lib/address";
import { LOAN_TYPES, PURPOSES, REFERRAL_SOURCES } from "@/lib/loan-facts";
import { ROLES } from "@/lib/roles";
import { CLOSED_REASONS, STAGES } from "@/lib/stages";

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

export const MoveLoanSchema = z.object({
  loanId: z.uuid(),
  to: z.enum(STAGES),
  /** Required by the stage machine for withdrawn and denied; ignored elsewhere. */
  closedReason: z.enum(CLOSED_REASONS).optional(),
  /** Free-text note the activity sentence appends: "…: buyer walked away". */
  reason: z.string().trim().max(200).optional(),
});

/**
 * Whole dollars, as typed: "425,000" and "$425,000" both mean 425000. The digits are
 * checked as a string before any conversion, because `Number` also accepts hex
 * ("0x186a0"), exponents and fractional cents — and `numeric(12,2)` would round "0.004"
 * to a loan for zero dollars.
 */
const MoneyField = z
  .string()
  .trim()
  .min(1, "Enter the loan amount.")
  .max(20, "Enter the loan amount in dollars, like 425000.")
  .transform((value) => value.replace(/[$,\s]/g, ""))
  .refine((digits) => /^\d+$/.test(digits), {
    message: "Enter whole dollars, like 425000.",
  })
  .transform((digits) => Number(digits))
  .refine((value) => value > 0, { message: "Enter an amount above zero." })
  .refine((value) => value <= 10_000_000, {
    message: "That is larger than this demo allows. Keep it under $10,000,000.",
  });

export const CreateLoanSchema = z.object({
  borrowerName: z.string().trim().min(2, "Enter the borrower's name.").max(80),
  borrowerEmail: z
    .email("Enter a full email address, like jamie@example.com.")
    .trim()
    .max(120, "That email address is longer than this demo accepts.")
    .toLowerCase()
    .refine((email) => email.endsWith("@example.com"), {
      message: "This demo only accepts @example.com addresses.",
    }),
  borrowerPhone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((value) => value || undefined),
  propertyAddress: z
    .string()
    .trim()
    .min(1, "Enter the property address.")
    .max(ADDRESS_MAX_LENGTH, "That address is longer than this demo accepts.")
    .refine((value) => parseAddress(value) !== null, {
      message: `Use the format ${ADDRESS_EXAMPLE}.`,
    })
    .transform((value) => {
      // Already proven parseable by the refine above.
      const parsed = parseAddress(value);
      if (!parsed) throw new Error("unreachable: address failed to parse");
      return parsed;
    }),
  purpose: z.enum(PURPOSES, { message: "Choose a purpose." }),
  loanType: z.enum(LOAN_TYPES, { message: "Choose a program." }),
  amount: MoneyField,
  referralSource: z.enum(REFERRAL_SOURCES, { message: "Choose a source." }),
  targetCloseDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    // A shape-only check would pass 2026-02-31 through to a `date` column, where Postgres
    // raises 22008 and the user gets an error page instead of a field message.
    .refine(
      (value) => value === undefined || z.iso.date().safeParse(value).success,
      { message: "Pick a target close date from the calendar." },
    ),
});

export type CreateLoanField = keyof z.infer<typeof CreateLoanSchema>;

export const RegenerateLinkSchema = z.object({ loanId: z.uuid() });
