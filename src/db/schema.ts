/**
 * Drizzle schema, implementing PLAN.md §6.
 *
 * Four tables belong to Better Auth (`user`, `session`, `account`, `verification`; the
 * admin plugin adds `user.role`, the ban columns and `session.impersonated_by`; Clearline
 * adds `user.nmls_id` and `user.phone`). Four are application tables. Enum values are
 * declared once, in `src/lib`, and become Postgres enums here; TypeScript property names
 * are camelCase because Better Auth's Drizzle adapter addresses columns by property name,
 * while the database columns are snake_case.
 *
 * `activity` is append-only: `drizzle/0001_activity_triggers.sql` adds the
 * `BEFORE UPDATE OR DELETE` triggers that raise. Only the reset's `TRUNCATE` bypasses them.
 *
 * No SSN, date of birth, income, credit or protected-class column exists anywhere.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ACTOR_KINDS } from "../lib/activity";
import { CONDITION_STATUSES, PRIOR_TO } from "../lib/conditions";
import { DOC_TYPES, REVIEW_STATUSES, UPLOADED_VIA } from "../lib/doc-types";
import { LOAN_TYPES, PURPOSES, REFERRAL_SOURCES } from "../lib/loan-facts";
import { ROLES } from "../lib/roles";
import { CLOSED_REASONS, STAGES } from "../lib/stages";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const money = (name: string) =>
  numeric(name, { precision: 12, scale: 2, mode: "number" });

// ---------------------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  // Admin plugin. `role` is text by design (PLAN.md §6); the least privileged role is the default.
  role: text("role", { enum: ROLES }).notNull().default("loan_officer"),
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamptz("ban_expires"),
  // Clearline additional fields. The NMLS id is fictional; loan officers only.
  nmlsId: text("nmls_id"),
  phone: text("phone"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamptz("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Set by the admin plugin while a superadmin views as this session's user. */
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------------------
// Enums (values live in src/lib; labels too)
// ---------------------------------------------------------------------------------------

export const stageEnum = pgEnum("stage", STAGES);
export const purposeEnum = pgEnum("purpose", PURPOSES);
export const loanTypeEnum = pgEnum("loan_type", LOAN_TYPES);
export const referralSourceEnum = pgEnum("referral_source", REFERRAL_SOURCES);
export const closedReasonEnum = pgEnum("closed_reason", CLOSED_REASONS);
export const conditionStatusEnum = pgEnum(
  "condition_status",
  CONDITION_STATUSES,
);
export const priorToEnum = pgEnum("prior_to", PRIOR_TO);
export const reviewStatusEnum = pgEnum("review_status", REVIEW_STATUSES);
export const uploadedViaEnum = pgEnum("uploaded_via", UPLOADED_VIA);
export const docTypeEnum = pgEnum("doc_type", DOC_TYPES);

export const actorKindEnum = pgEnum("actor_kind", ACTOR_KINDS);

// ---------------------------------------------------------------------------------------
// Application tables
// ---------------------------------------------------------------------------------------

export const loans = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    borrowerName: text("borrower_name").notNull(),
    borrowerEmail: text("borrower_email").notNull(),
    borrowerPhone: text("borrower_phone"),
    propertyStreet: text("property_street").notNull(),
    propertyCity: text("property_city").notNull(),
    propertyState: char("property_state", { length: 2 }).notNull(),
    propertyZip: text("property_zip").notNull(),
    purpose: purposeEnum("purpose").notNull(),
    loanType: loanTypeEnum("loan_type").notNull(),
    amount: money("amount").notNull(),
    purchasePrice: money("purchase_price"),
    /** Written only by `src/server/transitions.ts`. */
    stage: stageEnum("stage").notNull().default("lead"),
    stageEnteredAt: timestamptz("stage_entered_at").notNull().defaultNow(),
    applicationDate: date("application_date"),
    targetCloseDate: date("target_close_date"),
    fundedAt: timestamptz("funded_at"),
    closedReason: closedReasonEnum("closed_reason"),
    preapprovalAmount: money("preapproval_amount"),
    preapprovalExpiresOn: date("preapproval_expires_on"),
    loanOfficerId: text("loan_officer_id")
      .notNull()
      .references(() => user.id),
    processorId: text("processor_id").references(() => user.id),
    referralSource: referralSourceEnum("referral_source").notNull(),
    /** 32 random characters; the borrower's public page lives at /u/<token>. */
    uploadToken: text("upload_token").notNull().unique(),
    uploadTokenRevokedAt: timestamptz("upload_token_revoked_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("loans_stage_idx").on(t.stage),
    index("loans_loan_officer_id_idx").on(t.loanOfficerId),
    index("loans_target_close_date_idx").on(t.targetCloseDate),
  ],
);

export const conditions = pgTable(
  "conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Borrower-facing wording: "Your two most recent pay stubs, all pages." */
    instructions: text("instructions"),
    status: conditionStatusEnum("status").notNull().default("requested"),
    priorTo: priorToEnum("prior_to").notNull().default("docs"),
    /** False for internal items ("Appraisal received") that never reach the public page. */
    borrowerFacing: boolean("borrower_facing").notNull().default(true),
    lastRejectionReason: text("last_rejection_reason"),
    clearedBy: text("cleared_by").references(() => user.id),
    clearedAt: timestamptz("cleared_at"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("conditions_loan_id_idx").on(t.loanId)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    conditionId: uuid("condition_id").references(() => conditions.id, {
      onDelete: "set null",
    }),
    /** Null when the borrower uploaded through the public link. */
    uploadedBy: text("uploaded_by").references(() => user.id),
    uploadedVia: uploadedViaEnum("uploaded_via").notNull(),
    fileName: text("file_name").notNull(),
    /**
     * `uploads/<loanId>/...` for user uploads (unique, see the partial index below);
     * `seed/...` for the three specimen PDFs, which many seeded rows share.
     */
    blobPathname: text("blob_pathname").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    docType: docTypeEnum("doc_type"),
    reviewStatus: reviewStatusEnum("review_status")
      .notNull()
      .default("pending"),
    reviewReason: text("review_reason"),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamptz("reviewed_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("documents_blob_pathname_uploads_uidx")
      .on(t.blobPathname)
      .where(sql`${t.blobPathname} like 'uploads/%'`),
    index("documents_loan_id_idx").on(t.loanId),
    index("documents_condition_id_idx").on(t.conditionId),
    index("documents_review_status_created_at_idx").on(
      t.reviewStatus,
      t.createdAt,
    ),
  ],
);

export const activity = pgTable(
  "activity",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    /** Null for admin and system events. */
    loanId: uuid("loan_id").references(() => loans.id, { onDelete: "cascade" }),
    /** The human who acted; null for public-link uploads and system events. */
    actorId: text("actor_id").references(() => user.id),
    /** The user being impersonated when the human acted, if any. */
    onBehalfOf: text("on_behalf_of").references(() => user.id),
    actorKind: actorKindEnum("actor_kind").notNull(),
    /** Dot-namespaced: `loan.stage_changed`, `admin.impersonation_started`, … (PLAN.md §6). */
    action: text("action").notNull(),
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("activity_loan_id_created_at_idx").on(t.loanId, t.createdAt.desc()),
    index("activity_action_created_at_idx").on(t.action, t.createdAt.desc()),
  ],
);

export type User = typeof user.$inferSelect;
export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;
export type Condition = typeof conditions.$inferSelect;
export type NewCondition = typeof conditions.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Activity = typeof activity.$inferSelect;
export type NewActivity = typeof activity.$inferInsert;
