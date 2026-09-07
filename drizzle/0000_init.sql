CREATE TYPE "public"."actor_kind" AS ENUM('user', 'public_link', 'system');--> statement-breakpoint
CREATE TYPE "public"."closed_reason" AS ENUM('withdrawn_by_applicant', 'incomplete', 'credit', 'collateral', 'other');--> statement-breakpoint
CREATE TYPE "public"."condition_status" AS ENUM('requested', 'received', 'cleared', 'waived');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('photo_id', 'pay_stub', 'w2', 'tax_return', 'bank_statement', 'investment_statement', 'gift_letter', 'earnest_money', 'purchase_contract', 'appraisal', 'insurance_binder', 'title_commitment', 'mortgage_statement', 'letter_of_explanation', 'other');--> statement-breakpoint
CREATE TYPE "public"."loan_type" AS ENUM('conventional', 'fha', 'va', 'other');--> statement-breakpoint
CREATE TYPE "public"."prior_to" AS ENUM('approval', 'docs', 'funding');--> statement-breakpoint
CREATE TYPE "public"."purpose" AS ENUM('purchase', 'refinance');--> statement-breakpoint
CREATE TYPE "public"."referral_source" AS ENUM('realtor', 'past_client', 'online', 'other');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('lead', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close', 'funded', 'withdrawn', 'denied');--> statement-breakpoint
CREATE TYPE "public"."uploaded_via" AS ENUM('staff', 'public_link');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"loan_id" uuid,
	"actor_id" text,
	"on_behalf_of" text,
	"actor_kind" "actor_kind" NOT NULL,
	"action" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"title" text NOT NULL,
	"instructions" text,
	"status" "condition_status" DEFAULT 'requested' NOT NULL,
	"prior_to" "prior_to" DEFAULT 'docs' NOT NULL,
	"borrower_facing" boolean DEFAULT true NOT NULL,
	"last_rejection_reason" text,
	"cleared_by" text,
	"cleared_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"condition_id" uuid,
	"uploaded_by" text,
	"uploaded_via" "uploaded_via" NOT NULL,
	"file_name" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"doc_type" "doc_type",
	"review_status" "review_status" DEFAULT 'pending' NOT NULL,
	"review_reason" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_blob_pathname_unique" UNIQUE("blob_pathname")
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_name" text NOT NULL,
	"borrower_email" text NOT NULL,
	"borrower_phone" text,
	"property_street" text NOT NULL,
	"property_city" text NOT NULL,
	"property_state" char(2) NOT NULL,
	"property_zip" text NOT NULL,
	"purpose" "purpose" NOT NULL,
	"loan_type" "loan_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"purchase_price" numeric(12, 2),
	"stage" "stage" DEFAULT 'lead' NOT NULL,
	"stage_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"application_date" date,
	"target_close_date" date,
	"funded_at" timestamp with time zone,
	"closed_reason" "closed_reason",
	"preapproval_amount" numeric(12, 2),
	"preapproval_expires_on" date,
	"loan_officer_id" text NOT NULL,
	"processor_id" text,
	"referral_source" "referral_source" NOT NULL,
	"upload_token" text NOT NULL,
	"upload_token_revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loans_upload_token_unique" UNIQUE("upload_token")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text DEFAULT 'loan_officer' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"nmls_id" text,
	"phone" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_on_behalf_of_user_id_fk" FOREIGN KEY ("on_behalf_of") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_cleared_by_user_id_fk" FOREIGN KEY ("cleared_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_condition_id_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."conditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_loan_officer_id_user_id_fk" FOREIGN KEY ("loan_officer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_processor_id_user_id_fk" FOREIGN KEY ("processor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_loan_id_created_at_idx" ON "activity" USING btree ("loan_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activity_action_created_at_idx" ON "activity" USING btree ("action","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conditions_loan_id_idx" ON "conditions" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "documents_loan_id_idx" ON "documents" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "documents_condition_id_idx" ON "documents" USING btree ("condition_id");--> statement-breakpoint
CREATE INDEX "documents_review_status_created_at_idx" ON "documents" USING btree ("review_status","created_at");--> statement-breakpoint
CREATE INDEX "loans_stage_idx" ON "loans" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "loans_loan_officer_id_idx" ON "loans" USING btree ("loan_officer_id");--> statement-breakpoint
CREATE INDEX "loans_target_close_date_idx" ON "loans" USING btree ("target_close_date");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");