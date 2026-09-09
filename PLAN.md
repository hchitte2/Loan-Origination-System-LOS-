# Clearline · Demo Loan Origination System — Master Plan

v2 approved · 2026-09-06 · Owner: the planning chat · Executor: the coding chat.

This document is the spec. The coding chat starts every session by reading the **active phase** block (Section 9), proposes a short plan, builds, verifies, commits. The planning chat owns this file, `CLAUDE.md` and `.claude/`. When code and this plan disagree, the coding chat says so in its end-of-phase summary and the planning chat updates the plan. Section 14 records the decisions already made; do not reopen them in a coding session.

Facts about hosting limits, package versions, Claude Code syntax and mortgage vocabulary were verified on 2026-09-06. The prior brainstorm in `demo-los-kit/` is superseded.

---

## 1. Vision, scope, non-goals

**One paragraph.** Clearline is a "CRM for LOS": a small, believable slice of a US mortgage shop. A loan officer works leads and a pipeline, a processor collects and reviews documents against a needs list, a borrower uploads documents through a public link with no login, and a superadmin (broker-owner) sees everything and can step into any user's shoes. Visitors enter as the superadmin and explore every view by impersonating. It looks and behaves like production software, is understandable by a non-technical visitor without help, works in light and dark mode, and costs $0/month to run.

**In scope (the demo slice).** Pipeline by stage · loan record · conditions and documents (needs list) · per-loan public upload link · three distinct views (loan officer, processor, borrower page) plus the superadmin · impersonation · append-only audit log · role-scoped analytics · daily demo reset.

**Non-goals (say so in the README).** Borrower login and the 1003/URLA wizard, realtor portal (Stretch), credit pull, automated underwriting, pricing and rate locks, disclosures (LE/CD), e-signature, appraisal/title ordering, closing package, funding wire, servicing, email/SMS sending, multi-tenant orgs, websockets, AI document classification, mobile app, referral payouts.

**Scale assumptions.** Under 20 concurrent visitors, under 50 loans, under 300 documents at any time.

**Quality bar.** A senior engineer reads the repo and finds clear module boundaries, one authorization module, a database-enforced audit log, validated private uploads, abuse controls, migrations, a deterministic seed, CI and real tests. A mortgage person opens the link and understands every screen. WCAG 2.2 AA in both themes.

---

## 2. Roles, personas, permission matrix

Three login roles plus one no-login audience. Underwriter and closer actions are folded into the processor as explicit buttons ("Issue conditional approval", "Clear to close", "Mark funded") with a tooltip: "In production an underwriter / closer performs this step."

| Persona | Role (`user.role`) | Home route | Copy voice on their screens | Demo account |
|---|---|---|---|---|
| Priya Nair, broker-owner | `superadmin` | `/dashboard` | Neutral operator tone: "View as Alex Rivera", "Activity log" | priya@example.com |
| Alex Rivera (NMLS 1234567, fake) | `loan_officer` | `/pipeline` | Compact, commercial: "Move to Processing", "Copy Maria's link" | alex@example.com |
| Sam Okafor | `processor` | `/queue` | Precise, checklist-like: "Accept", "Reject · reason required", "Clear condition" | sam@example.com |
| Maria Chen | borrower, **no account** | `/u/<token>` | Warm and plain: "We need your two most recent pay stubs", "Nice, that's everything for now" | none |

The seed adds two more loan officers and one more processor without login cards so "assigned to" fields and the users list look like a real shop.

**The front door.** The login page leads with "Enter as Priya (Superadmin)". From the Users page Priya can "View as" Alex or Sam; the amber banner shows who she is viewing as, and Exit returns her. Alex and Sam also have their own "Enter as" cards as shortcuts. A "Try the borrower experience" button opens the showcase loan's public link. Three lines of suggested tour sit under the cards. No real users exist; every account is seeded.

**What happens to the borrower.** No login, no wizard, no `applications` table. Each loan has a tokenized public page; staff copy the link from the loan page and can regenerate it, which revokes the old one. This is how Floify and Blend "follow-ups" reach borrowers by email.

**Permission matrix.** W = write, R = read, – = hidden. "Own" = loans where the user is the assigned loan officer. Loan officers see the whole team pipeline but edit only their own loans. Processors see all active loans (one shared processing desk). Superadmin sees all; while impersonating, superadmin inherits exactly the target's column, and every write records who really acted.

| Capability / field | Loan officer | Processor | Superadmin | Public link |
|---|---|---|---|---|
| Loans: read scope | all, incl. terminal (board = six active columns, "Closed" = terminal, "Mine" filter) | all, incl. terminal (`/queue` lists active work only) | all, incl. terminal | one loan |
| Create loan | W | – | W | – |
| Edit borrower and property facts | W (own) | R | W | – |
| Borrower name | W (own) | R | W | R (self) |
| Borrower email, phone | W (own) | R | W | – |
| Property, purpose, program, amount, purchase price | W (own) | R | W | R |
| Assigned loan officer: name and phone | R | R | R | R |
| Stage moves among `lead ↔ application ↔ processing` (one step either way), `withdrawn` | W (own) | – | W | – |
| Stage moves `processing → underwriting → conditional_approval → clear_to_close → funded`, one step back but never below `processing`, `denied` | – | W | W | – |
| Stage and dates (friendly labels on the public page) | R | R | R | R |
| Target close date, pre-approval amount and expiry | W (own) | R | W | R |
| Conditions: add, edit, delete | W (own) | W | W | – |
| Conditions: clear, waive | – | W | W | – |
| Condition titles and status | R | R | R | R (borrower-facing only) |
| Condition rejection reason | R | W | W | R (plain language) |
| Documents: upload | W (own) | W | W | W (own loan) |
| Documents: download file | R | R | R | – (status only) |
| Documents: accept, reject with reason | – | W | W | – |
| Withdrawn / denied reason | W (own) | W | W | R (borrower label) |
| Public link: copy, regenerate | W (own) | W | W | – |
| Loan activity log | R | R | R | – |
| Users list, create user, impersonate | – | – | W | – |
| Global activity log (incl. impersonation events) | – | – | R | – |
| Reset demo data | – | – | W | – |
| Analytics | own | ops | everything | – |

This table is transcribed 1:1 into a role × action table in `src/server/authz.ts` (cell values `any`, `own`, or `false`), and `authz.test.ts` is driven from that same table. Docs, code and tests cannot drift silently. The public page renders only the output of `redactForPublic()`, which returns a distinct TypeScript type, so a component cannot type-check access to a hidden field.

---

## 3. Feature list

**Must (12).**
1. Login page: "Enter as Priya (Superadmin)" first, cards for Alex and Sam, "Try the borrower experience", a three-line tour. Real email + password sessions under the hood; nobody types a password.
2. App shell: sidebar for staff, top nav for the public page, persona chip, theme toggle (light / dark / system), "Demo · synthetic data" badge, skip link, per-role home route.
3. Pipeline board (loan officer, superadmin): one column per active stage (six), loan cards, designed empty columns, "Move to…" menu with guarded transitions, "Mine" filter, board/list toggle; terminal loans in the list view under "Closed".
4. New loan form: borrower, property, purpose, program, amount, referral source, target close date; auto-creates the default needs list.
5. Loan detail (staff): Overview (facts, people, dates, public link with copy/regenerate), Needs list (conditions with their documents; add/edit/clear/waive; accept/reject with reason; download), Activity (human sentences, newest first).
6. Stage machine with gates: allowed moves per role, reasons required for withdrawn/denied, clear-to-close gate on open non-funding conditions, funded gate on all conditions cleared or waived.
7. Processor queue (`/queue`): documents awaiting review oldest first, open conditions aging, processor KPI tiles; every row deep-links to the loan.
8. Public upload page `/u/<token>`: friendly milestone tracker, outstanding items, drag-and-drop upload per item (PDF/JPG/PNG, 10 MB), own-upload status ("Received, under review", "Needs another: reason"), e-consent checkbox, demo warning, designed expired/revoked-link state, mobile-first.
9. Superadmin: Users (list, create user, "View as"), persistent impersonation banner, global Activity page (recent events, filter by action), "Reset demo data" button.
10. Append-only activity log on every mutation, enforced by database triggers; rows carry the real actor and, when impersonating, who they acted as.
11. Analytics dashboards for superadmin, loan officer and processor (Section 7) built from four shared components.
12. Deterministic seed, daily reset cron, abuse caps, both themes passing axe.

**Should (after the Must list runs clean on the production URL).**
- Auto-refresh on loan detail, queue and public page every 30 s, only while the tab is visible, stopping after 10 minutes without interaction (protects Neon's compute budget).
- Leaderboard tile (loan officer production) on the superadmin dashboard.
- Global loan search (⌘K).

**Stretch (parking lot in `docs/DECISIONS.md`; needs a plan change).** Realtor / referral-partner portal · drag-and-drop on the board (dnd-kit, keyboard sensor; the menu stays as the accessible path) · AI document suggestion via the Claude API · realtime via Ably free tier · borrower login · pre-approval letter PDF · CSV export · magic-link invites · per-IP rate limits.

---

## 4. Hosting: options and recommendation

Requirements: $0/month, reachable by anyone at any time, private file uploads, a daily job. Facts verified 2026-09-06 against vendor pages.

| Option | Always on? | Facts that matter | Verdict |
|---|---|---|---|
| **A. Vercel Hobby + Neon Free + Vercel Blob (private)** | Yes. Nothing pauses. Neon compute scales to zero after 5 min idle and wakes in a few hundred milliseconds. | Vercel Hobby: 100 GB transfer, 1M function invocations, 300 s max function duration, cron once per day (fires within ±59 min, no retries), 4.5 MB request body (so uploads go browser-direct), **personal / non-commercial use only**, cannot link a GitHub org repo. Neon Free: 0.5 GB, 100 CU-hours per month, branching, no card, permanent. Blob Hobby: 1 GB, 10 GB transfer, **2,000 advanced ops per month** (every `put` and `list` counts; exceeding disables Blob for 30 days), private stores and client uploads supported. | **Chosen** |
| B. Vercel Hobby + Supabase Free (the prior kit's plan) | Only with a keep-alive | Project **pauses after 7 idle days**; a paused project is a hard error for visitors until someone clicks Resume. No official impersonation API. Local dev is ~12 containers, ~1.6 GB RAM on the M1. | Rejected |
| C. Cloudflare Workers + Neon + R2 | Yes | No commercial-use clause, unlimited bandwidth. But Workers is not Node, 10 ms CPU per request for server rendering, and R2 needs a payment card on file (not charged). | **Fallback** if Vercel objects to Hobby use |
| D. Laptop backend (M1 Air) + Cloudflare Tunnel | **No** | Free and unlimited bandwidth, but the link dies whenever the lid closes, the Mac sleeps, Wi-Fi drops or macOS restarts. `caffeinate` cannot prevent lid-close sleep; cloudflared has a documented macOS no-reconnect-after-sleep bug; ngrok's free tier shows an interstitial warning page to every visitor. | Live-presentation backup only |
| Netlify Free, Render Free, Fly, Railway, Koyeb, GitHub Pages | No | Netlify pauses all sites when monthly credits hit zero; Render sleeps after 15 min and its free Postgres expires after 30 days; Fly, Railway and Koyeb have no free tier any more; GitHub Pages is static only. | Rejected |

**Decision: everything online on Option A; the laptop is for development only.** Rules that keep it free forever: browser-direct uploads to a private Blob store · file metadata in Postgres, never `list()` at runtime · a global cap of 40 uploads per day (about 1,200 puts per month, under the 2,000 advanced-ops budget) and 10 MB per file · a once-a-day idempotent reset that purges user uploads · no keep-alive pinger against Neon (a 24/7 poller would burn ~180 CU-hours a month and suspend compute) · repo under the personal GitHub account (already true: `hchitte2/Loan-Origination-System-LOS-`, public).

**Commercial-use hedge.** Frame the deployment as a personal portfolio demo. If Vercel ever flags it, either pay $20 for one month of Pro while actively selling, or move the app to Cloudflare Workers via OpenNext; Neon, the schema and the code stay, and storage swaps behind the one-file storage module.

**Live-presentation backup.** Run the app locally against the Neon `dev` branch, expose it with `cloudflared tunnel --url http://localhost:3000` (Quick Tunnel, no account), laptop on power, lid open, `caffeinate -dims` running. Pre-warm the Vercel URL five minutes before any call so Neon compute is awake. Keep one screen recording as the last resort.

---

## 5. Architecture and stack

**Stack (pin these; versions are npm `latest` on 2026-09-06).**

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16.3 (App Router, Turbopack, `proxy.ts`), React 19.2, TypeScript 5.9 | Server Components and Server Actions cover every read and write; one language, one repo, one deploy |
| Styling / UI | Tailwind 4.3 (CSS-first `@theme` tokens), shadcn/ui (CLI 4), Recharts 3 via shadcn `ChartContainer`, `next-themes` | Design tokens from Claude Design map 1:1; shadcn's `.dark` class convention gives both themes from one token set; Recharts 3 ships `accessibilityLayer` on by default |
| Database | Neon Postgres Free, Drizzle ORM 0.45 + drizzle-kit 0.31 SQL migrations, `drizzle-orm/neon-serverless` on Vercel and `pg` locally | The Neon HTTP driver has no transactions; "write + activity row atomically" needs them |
| Auth | Better Auth 1.7 with the **admin plugin**, Drizzle adapter, `nextCookies()` as the last plugin | Impersonation is first class: `impersonateUser`, `stopImpersonating`, `session.impersonatedBy` |
| Files | Vercel Blob private store, client-direct uploads, authenticated streaming download route | Bypasses the 4.5 MB function body cap; private by default |
| Validation | zod 4 shared between forms and actions | One schema per input, used on both sides |
| Tooling | pnpm 12, Biome 2.5 (lint + format; `next lint` is gone), vitest 4.x (pin; 5.0 is days old), Playwright 1.63 + `@axe-core/playwright` 4.13, Node 22 LTS | One fast toolchain that hooks can run every turn |

**Not used, deliberately.** TanStack Query (RSC + `revalidatePath` + a 15-line `router.refresh()` interval hook cover it) · Postgres RLS (one app role; policy lives in one testable TypeScript module, stated in the README as a single-tenant simplification) · Docker by default (Neon `dev` branch; Docker Postgres is an optional offline alternative) · websockets · dnd-kit in Must · a second Neon role for the audit log (triggers do it with one connection string) · any LLM call.

**Theming.** Semantic tokens live once in `src/app/globals.css`: `:root` holds the light values, `.dark` holds the dark values, and `@theme inline` maps them to Tailwind utilities (shadcn's convention). `next-themes` provides `attribute="class"`, `defaultTheme="system"`, no flash on load; the toggle sits in the persona chip menu and is persisted per browser. Components never reference a raw colour, so dark mode is a token swap, not a second stylesheet. Charts read CSS variables. Axe runs in both themes.

**Module boundaries (dependency flows one way: `app → server/actions → server/queries → db|lib`).**

```
src/
  app/
    (auth)/login/                 superadmin-first cards, borrower-experience button, tour
    (staff)/layout.tsx            session, role nav, impersonation banner, demo badge, theme provider
    (staff)/pipeline/             board + list (loan officer, superadmin)
    (staff)/loans/new/            create loan
    (staff)/loans/[id]/           Overview · Needs list · Activity tabs
    (staff)/queue/                processor home
    (staff)/dashboard/            role-composed analytics (superadmin home; loan officer variant)
    (staff)/admin/users/          superadmin: users, create, View as
    (staff)/admin/activity/       superadmin: global activity, filter by action
    u/[token]/                    public borrower page, no session
    api/auth/[...all]/            Better Auth handler
    api/upload/route.ts           Blob handleUpload: staff session OR public token in clientPayload
    api/files/[documentId]/       authenticated download, streams the private blob
    api/cron/reset/route.ts       daily reset, CRON_SECRET bearer
  server/
    auth.ts                       Better Auth config (admin plugin, adminRoles: ['superadmin'], 4 h impersonation window)
    actor.ts                      requireActor() → { userId, role, actorUserId, impersonating }; requirePublicLoan(token)
    authz.ts                      the role × action table, can(), loanScope() (Drizzle where), redactForPublic()
    transitions.ts                stage machine: allowed moves per role, gates, reason rules (pure)
    activity.ts                   logActivity(tx, {...}) — the only writer of the activity table
    limits.ts                     MAX_FILE_BYTES, ALLOWED_TYPES, DAILY_UPLOAD_CAP, PER_LOAN_UPLOAD_CAP, DAILY_LOAN_CAP, RESET_MIN_INTERVAL
    storage.ts                    putToken / getStream / delete behind one interface (Vercel Blob today, R2 tomorrow)
    queries/                      loans.ts, conditions.ts, documents.ts, activity.ts, analytics.ts, public.ts
    actions/                      loans.ts, conditions.ts, documents.ts, admin.ts, public.ts — thin: zod → requireActor → can → tx(write + logActivity) → revalidatePath
  db/
    schema.ts                     Drizzle schema (Better Auth tables + four app tables)
    index.ts                      exposes db() — a lazily created client: neon-serverless on Vercel, pg elsewhere; never a module-level instance
    seed.ts                       deterministic fixture relative to today; also the reset routine
    specimens/                    three PDFs watermarked "SPECIMEN — SYNTHETIC"
  lib/
    stages.ts                     enum, order, staff labels, borrower labels — the single source of labels
    doc-types.ts                  document type catalog
    analytics-math.ts             pure KPI formulas (tested)
    format.ts, env.ts             money and dates; getEnv() validates process.env with zod at use time, never at import (next build and unit tests must not demand secrets)
  components/
    ui/                           shadcn primitives
    Pill, KpiTile, EmptyState, ConfirmDialog, ImpersonationBanner, DemoBadge, ThemeToggle, UploadZone,
    MilestoneTracker, StageBarChart, AgingBarChart, AttentionTable, LoanCard, LoanTable
drizzle/                          committed SQL migrations (never edited once applied)
tests/ unit/  db/  e2e/
design/ DESIGN-PROMPT.md  handoff/ (README.md, tokens.md, reference/*.png, html/ — the approved Claude Design handoff; reference only, never imported)
docs/ DECISIONS.md  DEMO.md  RUNBOOK.md  archive/demo-los-kit/
```

**Authorization and impersonation.**
- `requireActor()` reads the Better Auth session on the server and returns the *effective* user (`userId`, `role`) plus `actorUserId = session.impersonatedBy ?? userId`. Authorization uses the effective user; the audit log records both.
- `proxy.ts` does only the optimistic cookie redirect. Every layout, page, route handler and Server Action re-checks with `requireActor()` and `can()`. Server Actions are reachable by direct POST, so a hidden button is never the control.
- `loanScope(actor)` returns the row filter. Reads: every staff role sees every loan including terminal ones; list surfaces filter by stage themselves (board = six active columns, "Closed" = terminal, `/queue` = active loans only). Writes: superadmin any loan; loan officer `loan_officer_id = me`; processor active loans only. Public reads go through `queries/public.ts`, which selects only permitted columns; never "fetch all then hide". Server Components serialise whatever the page fetched, so projection happens at the query, and an end-to-end test asserts hidden fields are absent from the raw response body.
- Impersonation start and stop are Server Actions in `actions/admin.ts` that call `auth.api.impersonateUser` / `stopImpersonating` and write `admin.impersonation_started` / `admin.impersonation_ended` activity rows in the same request. Superadmins cannot impersonate other superadmins (plugin default).
- Banner spec: fixed top bar on every page while impersonating, amber background with dark text (AA in both themes), `role="status"`, text "Viewing as Sam Okafor · Processor · Exit view"; Exit is a real button and the first tab stop after the skip link; the superadmin nav is hidden while impersonating so the operator sees exactly what the user sees.

**Audit log.** `activity` is append-only: the migration adds `BEFORE UPDATE OR DELETE` triggers that raise; only the reset's `TRUNCATE` bypasses row triggers, and the README says so. Every mutation writes exactly one row inside the same transaction as the change: `actor_id` (the human; null for public-link uploads), `on_behalf_of` (the impersonated user or null), `actor_kind` (`user` | `public_link` | `system`). The loan's Activity tab and the superadmin Activity page render sentences like "Priya Nair (viewing as Sam Okafor) rejected Pay stubs: pages are cut off".

**File storage.** Browser → `upload()` from `@vercel/blob/client` with `access: 'private'` and `handleUploadUrl: '/api/upload'`. The route's `onBeforeGenerateToken` authenticates (staff session, or a live loan token in `clientPayload`), restricts `allowedContentTypes` to PDF/JPEG/PNG and `maximumSizeInBytes` to 10 MB, checks the daily caps, and fixes the pathname prefix to `uploads/<loanId>/`. After `upload()` resolves the browser calls `registerDocument` (`actions/documents.ts`, staff session) or `registerPublicDocument` (`actions/public.ts`, loan token); each re-authorizes, rejects any pathname outside `uploads/<loanId>/`, inserts the row, moves the condition to `received` and logs activity. Do not rely on `onUploadCompleted` (it never fires on localhost). Downloads go through `/api/files/[documentId]` with `requireActor` + `can('document.download')`, streamed with `Cache-Control: private, no-store`. The public page sees status only, never bytes. Seed specimens live under `seed/*` paths and are never deleted by the reset, so reseeding costs zero advanced ops.

**Abuse controls for a public URL, all in `server/limits.ts` and computed from rows that already exist (no counters table).** 10 MB per file, three MIME types · 10 uploads per loan per day and 40 per day globally (counts of `documents.created_at` since 00:00 UTC) · 30 new loans per day (`DAILY_LOAN_CAP`, counted from `loans.created_at` since 00:00 UTC, enforced inside the `createLoan` action, which returns `{ ok: false, error: "Demo limit reached, try again tomorrow" }` on a hit) · manual reset at most once per 10 minutes (last `demo.reset` row) · uploads refused on terminal-stage loans and revoked tokens · `robots: noindex` · `frame-ancestors 'none'` · every page carries "Demo system with synthetic data. Do not upload real personal documents." Residual risk accepted and stated: anyone can enter as the superadmin and vandalise synthetic data; the daily reset bounds the damage to 24 hours.

**Environment.** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `DEMO_PASSWORD`, `DEMO_SHOWCASE_TOKEN`. Local dev points `DATABASE_URL` at the Neon `dev` branch; production uses `main`. No secret is ever `NEXT_PUBLIC_`.

---

## 6. Data model

Eight tables: four owned by Better Auth (`user`, `session`, `account`, `verification`, generated by `npx @better-auth/cli generate`; the admin plugin adds `user.role` and `session.impersonatedBy`; we add `user.nmls_id` and `user.phone` via `additionalFields`) and four application tables. No `loan_members` join table (one loan officer and one processor per loan), no `applications`, no `rate_limits`, no `stage_history` (turn times derive from `loan.stage_changed` rows).

**Enums** (`src/lib/stages.ts` and `src/lib/doc-types.ts` mirror them with labels).

| Enum | Values |
|---|---|
| `stage` | `lead, application, processing, underwriting, conditional_approval, clear_to_close, funded, withdrawn, denied` — six active, three terminal |
| Staff labels | Lead · Application · Processing · Underwriting · Conditional approval · Clear to close · Funded · Withdrawn · Denied |
| Borrower labels | Getting started · Application received · Gathering your documents · In underwriting review · Conditionally approved · Clear to close · Closed and funded · Application withdrawn · Not approved |
| `purpose` | `purchase, refinance` |
| `loan_type` | `conventional, fha, va, other` (seed roughly 70 / 15 / 12 / 3) |
| `referral_source` | `realtor, past_client, online, other` |
| `closed_reason` | `withdrawn_by_applicant, incomplete, credit, collateral, other` (mirrors HMDA action-taken codes) |
| `condition_status` | `requested, received, cleared, waived` |
| Borrower condition labels | Needed (`requested`) · Received, under review (`received`) · Accepted (`cleared`) · No longer needed (`waived`, no upload zone) · "Needs another: <reason>" is a `requested` item whose last upload was rejected |
| `prior_to` | `approval, docs, funding` |
| `review_status` | `pending, accepted, rejected` |
| `uploaded_via` | `staff, public_link` |
| `actor_kind` | `user, public_link, system` |
| `doc_type` | `photo_id, pay_stub, w2, tax_return, bank_statement, investment_statement, gift_letter, earnest_money, purchase_contract, appraisal, insurance_binder, title_commitment, mortgage_statement, letter_of_explanation, other` |
| `role` (text on `user`) | `loan_officer, processor, superadmin` |

**Tables.**

| Table | Columns |
|---|---|
| `loans` | `id uuid pk` · `borrower_name` · `borrower_email` · `borrower_phone?` · `property_street, property_city, property_state char(2), property_zip` · `purpose` · `loan_type` · `amount numeric(12,2)` · `purchase_price?` · `stage default 'lead'` · `stage_entered_at` · `application_date?` · `target_close_date?` · `funded_at?` · `closed_reason?` · `preapproval_amount?` · `preapproval_expires_on?` · `loan_officer_id → user` · `processor_id? → user` · `referral_source` · `upload_token text unique` (32 random chars) · `upload_token_revoked_at?` · `created_at, updated_at`. Indexes: `stage`, `loan_officer_id`, `upload_token`, `target_close_date`. |
| `conditions` | `id` · `loan_id → loans cascade` · `title` · `instructions?` (borrower-facing text) · `status default 'requested'` · `prior_to default 'docs'` · `borrower_facing bool default true` · `last_rejection_reason?` · `cleared_by?` · `cleared_at?` · `created_by?` · `created_at, updated_at` |
| `documents` | `id` · `loan_id cascade` · `condition_id? → conditions` · `uploaded_by? → user` (null for public link) · `uploaded_via` · `file_name` · `blob_pathname unique` · `content_type` · `size_bytes` · `doc_type?` · `review_status default 'pending'` · `review_reason?` · `reviewed_by?` · `reviewed_at?` · `created_at` |
| `activity` | `id bigint identity` · `loan_id? → loans cascade` (null for admin and system events) · `actor_id? → user` · `on_behalf_of? → user` · `actor_kind` · `action text` · `detail jsonb default '{}'` · `created_at`. Indexes `(loan_id, created_at desc)`, `(action, created_at desc)`. Triggers `activity_no_update`, `activity_no_delete` raise. |

**Action names (dot-namespaced).** `loan.created`, `loan.updated`, `loan.stage_changed {from,to,reason?}`, `loan.link_regenerated`, `loan.link_copied`, `condition.created`, `condition.updated`, `condition.cleared`, `condition.waived {reason}`, `condition.deleted`, `document.uploaded {via, econsent?}`, `document.accepted`, `document.rejected {reason}`, `admin.user_created`, `admin.impersonation_started {target}`, `admin.impersonation_ended {target}`, `demo.reset`.

`loan.link_copied` is written by a fire-and-forget server action fired after the clipboard write on the loan Overview; it adds no UI beyond the existing toast, and a failure to log never blocks the copy.

**Invariants (enforced in `transitions.ts` and actions, covered by vitest).**
1. Stage moves follow the ordered list: one step forward or one step back among the six active stages; any active stage → `withdrawn` or `denied` requires `closed_reason`; `funded` only from `clear_to_close` and sets `funded_at`; terminal stages never move. Moving into `application` sets `application_date` if empty. Every move writes `loan.stage_changed` and resets `stage_entered_at`.
2. Entering `clear_to_close` requires zero `requested`/`received` conditions whose `prior_to` is `approval` or `docs`; entering `funded` requires every condition `cleared` or `waived`. (The default needs list's homeowners insurance item is `prior_to = funding`, so the demo can reach clear to close realistically.)
3. Registering a document against a `requested` condition moves it to `received`. Rejecting requires `review_reason` and, if no other accepted document remains, moves the condition back to `requested` with `last_rejection_reason`. Clearing requires at least one accepted linked document, or an explicit waive with a reason.
4. Every mutation writes exactly one activity row in the same transaction, with `actor_id` and `on_behalf_of` from the actor context.
5. Public-link uploads target only `borrower_facing` conditions on non-terminal loans with a live token.
6. Default needs list for a purchase loan: Government photo ID · Pay stubs (last 30 days) · W-2s (last 2 years) · Bank statements (last 2 months) · Purchase contract · Homeowners insurance binder (`prior_to = funding`). Refinance swaps the last two for Mortgage statement and Homeowners insurance declarations.
7. No SSN, DOB, income, credit, DTI or protected-class fields exist anywhere, including seed data. All names, addresses and amounts are fictional; emails end in `@example.com`.
8. Terminal loans (`funded`, `withdrawn`, `denied`) are read-only for every role including superadmin: no fact edits, no condition changes, no uploads, no document reviews — only reads and the activity log. Enforced in `can()` so every write action inherits it rather than each one re-checking the stage.
9. A condition can be deleted only while it is `requested` and has no documents. Otherwise it is waived with a reason, so the paper trail survives.

**Seed fixture (`src/db/seed.ts`, deterministic, all dates relative to today).** About 25 loans: 13 active spread across the six stages (two or three per column; Underwriting may be empty on day one), 9 funded (4 in the current calendar month, 2 last month, 3 in the two months before; `application_date` 31–45 days before `funded_at`), 2 withdrawn, 1 denied; Alex owns about 10, the other two loan officers the rest; the pull-through cohort (`application_date` 60–180 days ago) holds about 11 loans of which 8 are funded, so the tile reads ~73% and "Funded this month" shows 4 with a delta over last month's 2; 2 stalled loans; 3 with `target_close_date` within 14 days; 6–8 conditions per active loan in mixed statuses and ages; 2–4 document rows per processing-or-later loan pointing to the three specimen PDFs; back-dated `stage_changed` rows so turn-time maths works; one showcase loan whose `upload_token` equals `DEMO_SHOWCASE_TOKEN`. The same module is the reset routine.

---

## 7. Analytics dashboard

One `queries/analytics.ts` takes `loanScope(actor)` and returns numbers; pure formulas live in `lib/analytics-math.ts` (tested with fixed rows). Four shared components compose every dashboard: `KpiTile` (value, delta, a focusable definition disclosure, tabular numerals), `StageBarChart`, `AgingBarChart`, `AttentionTable`. Every chart keeps Recharts' `accessibilityLayer`, has a visually hidden text summary, and has designed loading and empty states once, on the component. Chart colours come from theme tokens so both modes work.

**Definitions.**
- **Active pipeline**: count and `sum(amount)` of loans in the six active stages.
- **Funded this month**: units and `sum(amount)` where `funded_at` is in the current calendar month; delta vs prior month.
- **Pull-through**: `funded ÷ loans with application_date 60–180 days ago` (the ICE cohort method), as a percentage, with the benchmark note "industry ~70–78%".
- **Avg cycle time**: mean of `funded_at − application_date` in days over loans funded in the last 90 days; benchmark note "ICE: ~37 days".
- **Pipeline by stage** (bar): count per active stage, dollars in the tooltip.
- **Conditions aging** (bar): open conditions bucketed 0–3, 4–7, 8–14, 15+ days.
- **Needs attention** (table): active loans stalled beyond a per-stage threshold (processing 10 d, underwriting 5 d, conditional approval 7 d, clear to close 5 d) or with `target_close_date` within 14 days and not yet clear to close; columns loan, stage, days in stage, target close, reason chip; rows link to the loan.

| Role | Tiles | Chart | Table or list |
|---|---|---|---|
| Superadmin (`/dashboard`) | Active pipeline · Funded this month · Pull-through · Avg cycle time | Pipeline by stage · Conditions aging | Needs attention (all loans). Should: Leaderboard |
| Loan officer (`/dashboard`, linked from `/pipeline`) | My active pipeline · My funded this month · Closing in 14 days (mine) | My pipeline by stage | Needs attention (mine) |
| Processor (`/queue`) | Documents awaiting review (+ oldest age) · Open conditions · Active files | Conditions aging | Review queue: pending documents oldest first, each a deep link |

---

## 8. Claude Design phase

Design happens before product UI is coded. The prompt lives in `design/DESIGN-PROMPT.md`; the user iterates in Claude Design, exports, and gives the green signal. Phase 0 tooling and Phase 1's non-visual work run in parallel with design.

**Artboards (7 + one component sheet). Desktop 1440 px for staff screens; the public page at 390 px and 1440 px. Light theme for every artboard; dark variants of the login, pipeline and public page; the component sheet in both themes.**
1. Login: wordmark, "Enter as Priya (Superadmin)" leading, cards for Alex and Sam, "Try the borrower experience", three-line tour, synthetic-data badge. Bar: "a product's landing page, not a dev tool".
2. Pipeline board with the staff app shell: six columns, loan cards, one designed empty column, "Mine" filter, board/list toggle, "Move to…" menu open on one card, theme toggle in the persona chip.
3. Loan detail (staff): header with stage pill and actions; Needs list tab with one condition expanded to its documents, inline accept/reject with the reason field; Activity tab as a secondary state; public-link copy/regenerate in Overview.
4. Processor queue: KPI tiles, documents awaiting review, conditions aging.
5. Public upload page (390 px and 1440 px): milestone tracker, needs-list cards with upload zone in idle, uploading, received, "needs another: reason" and all-done states; e-consent checkbox; demo warning; the expired/revoked-link page.
6. Dashboard: superadmin composition; loan officer composition as a variant.
7. Superadmin: Users with "Create user" and "View as"; the impersonation banner shown over the pipeline; the Activity page.
8. Component sheet (light and dark): tokens and type scale; Pill in every stage, condition and review state (icon + text, never colour-only); buttons and focus ring; form field with error; EmptyState; skeleton; ConfirmDialog; toast; ImpersonationBanner; DemoBadge; ThemeToggle; table row states; reduced-motion note.

**How the handoff feeds the codebase.** The approved handoff lives in `design/handoff/`: `README.md` (screen-by-screen spec, shells, icon mapping), `tokens.md` (light and dark values, the single source of design values), `reference/*.png` (27 frames at 2×, the pixel targets) and `html/` (a reference build plus `data.js`, the exact sample data for the seed; never copied into the app). The planning chat transcribed the tokens into `.claude/skills/design-system/SKILL.md` on 2026-09-07. The coding session copies them once into `src/app/globals.css` (`:root` and `.dark`) and uses the PNGs and README only as targets for layout and copy. axe's contrast rule in the a11y spec catches transcription mistakes in both themes.

**Sign-off gate.** Green signal received 2026-09-07 with the finalised handoff. Tokens are frozen in the design-system skill; the UI half of Phase 1 and everything after it is unblocked.

---

## 9. Build phases

Each phase is one branch `phase-N-<slug>` and one pull request into `main` (CLAUDE.md, Git workflow): small conventional commits per step, CI green, `/verify` green, a rebase merge so the step commits survive, a `phase-N` tag, then a 10-minute hand verification by the user on the production URL. Phase 0 was committed directly on `main` before this rule existed. Branch protection on `main` requires a PR and the `biome · tsc · vitest` check (enabled 2026-09-07); the repo owner can bypass it, which the planning chat uses only for docs-only commits to `PLAN.md`, `CLAUDE.md`, `.claude/`, `design/` and `docs/`. Code always goes through a PR. Target: Phases 2–5 complete by Thursday 2026-09-10; the Must list only, every Should item deferred until after that date. A session is one Claude Code coding session of one to three hours. Phase headings carry a status line the SessionStart hook reads; the planning chat flips `not started → active → done`.

### Phase 0 — Repo, tooling, guardrails, placeholder deploy
Status: done · closed 2026-09-07 at `876c6dd`; production placeholder at `clearline-gilt.vercel.app`

**User does first:** create the Vercel project from the personal GitHub repo · create the Neon project with `main` and `dev` branches (Vercel Marketplace integration or neon.com) · create one private Blob store · install `jq`, `pnpm` and Node 22 on the Mac.

**Planning chat delivered:** `CLAUDE.md`, the `.claude/` tree (Section 10), `design/DESIGN-PROMPT.md`, `docs/DECISIONS.md`.

**Coding chat tasks:** scaffold with `create-next-app` (TypeScript, Tailwind, App Router, `src/` dir, Biome, pnpm) into the repo root; `shadcn init`; add Drizzle, Better Auth, `@vercel/blob`, zod, `next-themes`, vitest, Playwright, axe; `lib/env.ts`; `db/index.ts` driver switch; `.env.example`; `vercel.json` with the cron; `.github/workflows/ci.yml` (biome check, tsc, vitest on push and pull request) and `.github/PULL_REQUEST_TEMPLATE.md` (added by the planning chat); one trivial unit test and one trivial Playwright test; a placeholder home page; `pnpm` scripts `dev check typecheck test test:db e2e db:generate db:migrate db:seed db:reset seed:files db:migrate:prod db:seed:prod`; README with non-goals and the hosting story. (`demo-los-kit/` is already archived under `docs/archive/` with its files renamed so nothing auto-loads.)
**Done when:** CI is green on `main`; the Vercel URL renders the placeholder; `pnpm check` (biome + tsc + vitest) passes locally; every hook fires (Stop hook blocks a deliberate type error; PreToolUse hook denies `rm -rf x`).
**Verify (10 min):** open the Vercel URL; run `pnpm check`; in a Claude session, introduce a type error, end the turn, watch the block, revert.

### Phase 1 — Schema, auth, roles, impersonation, audit, deploy
Status: done · closed 2026-09-08 · PR #1 merged, tag `phase-1`, production migrated and seeded (25 loans, 158 conditions, 52 documents)

**Tasks (no design needed):** `db/schema.ts` per Section 6 → `pnpm db:generate` → `drizzle/0000_init.sql` → `pnpm db:generate --custom --name activity_triggers` → hand-write `activity_no_update` / `activity_no_delete` (`BEFORE UPDATE OR DELETE`, raise) in `drizzle/0001_activity_triggers.sql` → `schema-guard` → `pnpm db:migrate` on `dev` and `main` · Better Auth config (email + password, admin plugin, `impersonationSessionDuration: 14400`, `nextCookies()` last) and `app/api/auth/[...all]/route.ts` · `proxy.ts` · `requireActor`, `authz.ts` transcribed from the Section 2 matrix, `transitions.ts`, `lib/stages.ts`, with vitest tables · `seed.ts` (users with `DEMO_PASSWORD`, the fixture) and `pnpm db:seed` · impersonation actions writing activity rows · unstyled `/admin/users` and `/admin/activity` behind authorization · deploy, migrate and seed `main`.
**Tasks (after the green signal):** the complete token set from the design-system skill into `globals.css` for both themes (the Phase 0 placeholder lacks `success`, `warning`, `destructive-foreground`, `chart-6`, `banner`, `banner-foreground` and the two shadows; `Pill` and the banner need them) · `ThemeProvider` and `ThemeToggle` · login page from `design/handoff/reference/01-login-*.png` · staff shell with home-route redirects · `ImpersonationBanner` · styled Users and Activity pages · Playwright scaffold (persona-card login helper) with `login.spec.ts` and `a11y.spec.ts` covering `/login` and `/admin/users` in light and dark.
**Done when:** all three personas log in on the **production URL** and land on their empty-but-styled home; Priya views as Sam, sees the banner on every page, cannot reach `/admin/users` while impersonating, exits; `/admin/activity` shows both impersonation rows; `authz.test.ts` covers every matrix cell; an `UPDATE activity` throws (pglite test if it takes under 30 minutes to set up, otherwise verified by hand); the theme toggle persists across reloads with no flash; the `phase-1-foundation` PR is merged with CI green and `main` is tagged `phase-1`.
**Verify:** three cards on the prod URL; impersonate and exit; keyboard-only from login to Exit view; switch to dark and reload; `pnpm test`.
**.claude additions:** `authz-reviewer` and `schema-guard` checklists finalised against the real schema.

### Phase 2 — Pipeline, new loan, loan detail, stage machine
Status: done · closed 2026-09-08 · PR merged, tag `phase-2` · coding chats run on Opus from here; Fable is reserved for the planning chat

**Tasks:** `/pipeline` board (six columns, `LoanCard`, empty columns, "Mine" filter, "Move to…" menu honouring `transitions.ts`, reason dialog for withdrawn/denied) and list toggle (`LoanTable`, terminal loans under "Closed") · `/loans/new` (zod, `useActionState`, default needs list) · `/loans/[id]` Overview (facts, people, dates, public link copy/regenerate) and Activity tab · conditions add/edit/delete (clear/waive arrive with documents in Phase 3) · processor decision buttons with tooltip · `loading.tsx`, `error.tsx`, empty states per route · extend `a11y.spec.ts` with `/pipeline` and `/loans/[id]` · `ui-reviewer` pass per screen in both themes.
**Done when:** Alex creates a loan, moves it lead → application → processing, Sam moves it to underwriting and back, a move to funded from processing is disabled, a withdraw requires a reason; Alex cannot edit a loan owned by another officer; every move is one activity row.
**Verify:** run that sentence in the browser; `pnpm test`; axe via `/verify` in both themes.

### Phase 3 — Documents, public link, review loop, processor queue
Status: done · closed 2026-09-08 · PR merged, tag `phase-3`

**Tasks:** `limits.ts` `DAILY_LOAN_CAP` enforced in `createLoan` with a `limits.test.ts` row **first**, since `createLoan` is already internet-facing · `server/storage.ts` · `/api/upload` with `handleUpload` (dual auth, types, 10 MB, prefix, caps) · `UploadZone` + `registerDocument` / `registerPublicDocument` · `/api/files/[documentId]` · Needs list tab: documents under their condition, accept, reject with reason, download, clear (with "Clear this condition?" prompt after accepting the last document), waive with reason · `/u/[token]` from artboard 5 with all drawn states, e-consent stored in the `document.uploaded` detail · `/queue` with KPI tiles and the review list · the upload and reset caps in `limits.ts` enforced and unit-tested · specimens uploaded once by `pnpm seed:files` · extend `a11y.spec.ts` with `/queue` and `/u/[token]`.
**Done when:** in a private window with no session, Maria uploads a specimen PDF via the showcase link → Sam's queue shows it → reject with reason → Maria's page shows "Needs another: reason" → re-upload → accept → clear → Sam can advance the loan to clear to close only once every non-funding condition is cleared or waived, and the "Clear to close" button stays disabled until then; an 11 MB file and a `.exe` are refused kindly; a revoked link shows the designed expired page; a file URL in a logged-out tab returns 401.
**Verify:** the loop above on the prod URL with phone + laptop; the oversize file; `pnpm test`.
**.claude additions:** `public-upload.spec.ts` and `impersonation.spec.ts` join the Playwright suite.

### Phase 4 — Analytics
Status: active · combined with Phase 5 on branch `phase-4-5-dashboards-and-reset`, deadline scope below

**Tasks:** `lib/analytics-math.ts` with tests · `queries/analytics.ts` · `KpiTile`, `StageBarChart`, `AgingBarChart`, `AttentionTable` · three role compositions per Section 7 · click-throughs from tables to loans.
**Done when:** every persona's dashboard matches Section 7 with non-empty seeded numbers; "Funded this month" reconciles with a hand count in the Closed list; axe reports no serious or critical issues in either theme; a chart is navigable by keyboard; tile definitions are reachable by keyboard.
**Verify:** open all three dashboards; hand-check three numbers; tab through one chart; enable OS reduced motion and confirm no chart animation.

### Phase 5 — Reset, hardening, smoke tests, demo readiness
Status: active · combined with Phase 4 on branch `phase-4-5-dashboards-and-reset`, deadline scope below

**Tasks:** `api/cron/reset` (delete user-uploaded blobs by recorded `documents.blob_pathname` under `uploads/*`, never `seed/*` → truncate app tables → reseed relative to today → `demo.reset` row; blobs go first so a failure mid-run leaves the pathnames in the table for the next run) guarded by `CRON_SECRET`; `vercel.json` cron `0 8 * * *`; superadmin "Reset demo data" button with confirm and the 10-minute interval · security headers and `noindex` · loading/empty/error sweep with `ui-reviewer` · copy pass · Playwright suite (Section 11) green locally, including `demo-path.spec.ts` · `docs/DEMO.md` (Section 13) and `docs/RUNBOOK.md` (env, migrate, seed, reset, Neon wake, tunnel backup; note that Vercel marks secrets Sensitive so `vercel env pull` writes blanks for them and the values are pasted into `.env.production.local` by hand before `/release`; the six app secrets exist only in Production until someone adds them to the Preview environment) · README screenshots in both themes · rehearse the script twice on the prod URL.
**Done when:** `curl -H "Authorization: Bearer $CRON_SECRET" <url>/api/cron/reset` restores the fixture in under 60 s and is idempotent when run twice; yesterday's uploads are gone after reset; the demo script runs clean twice in a row on the production URL; Lighthouse accessibility ≥ 95 on login, pipeline and the public page.
**Verify:** hit the reset route; reload the dashboards; run the script with a timer; check the Vercel cron log the next morning.
**.claude additions:** `demo-walker` agent drives Section 13 against the production URL via the Playwright MCP.

#### Deadline scope for Phases 4 + 5 (set 2026-09-08)

Phases 4 and 5 run as one branch `phase-4-5-dashboards-and-reset` and one pull request, closing at the Thursday 2026-09-10 target. **Build exactly this, nothing from Should or Stretch.**

**Analytics.** `lib/analytics-math.ts` with unit tests (pull-through, cycle time, aging buckets, stalled thresholds) · `queries/analytics.ts` scoped by `loanScope()` · reuse the `KpiTile` and aging chart the queue already has, add `StageBarChart` and `AttentionTable` · superadmin `/dashboard` per `06-dashboard.png` (four tiles with keyboard-reachable definitions, two charts, Needs attention linking to loans) · loan-officer variant per `06-dashboard-lo.png` from the same components. Numbers reconcile with a hand count; axe clean in both themes.

**Reset and hardening.** `/api/cron/reset` behind `CRON_SECRET` (delete uploaded blobs by recorded pathname under `uploads/`, never `seed/`, then truncate, reseed relative to today, write the `demo.reset` row; idempotent) · superadmin "Reset demo data" button with `ConfirmDialog` and the 10-minute interval · `noindex` and `frame-ancestors 'none'` headers.

**Tests and docs.** `tests/e2e/demo-path.spec.ts` walking Section 13 end to end · the whole Playwright suite green locally · DEMO and RUNBOOK folded into README sections (how to run, hosting story, non-goals, the demo script, the release steps including the pasted-secrets caveat).

**Cut on purpose:** the Lighthouse target, a full loading/empty/error sweep (only screens on the demo path are fixed), separate `docs/DEMO.md` and `docs/RUNBOOK.md`, README screenshots.

**Total: 10–13 coding sessions across six phases.**

---

## 10. `.claude` and agentic workflow

```
CLAUDE.md                          ~120 lines: product paragraph, commands, module map, hard rules, session ritual
PLAN.md                            this file; phase status lines drive the SessionStart hook
.mcp.json                          playwright (stdio, npx -y @playwright/mcp@latest) for browser verification
vercel.json                        framework: nextjs (so builds never depend on dashboard state) + crons: [{ path: /api/cron/reset, schedule: 0 8 * * * }]
.github/workflows/ci.yml           biome check · tsc --noEmit · vitest, on every push and pull request
.github/PULL_REQUEST_TEMPLATE.md   phase, changes, done-when checklist, verification, screenshots, drift
.claude/
  settings.json                    permissions + hooks (committed)
  settings.local.json              personal overrides (gitignored); also the emergency hook bypass
  prod-db-host                     the Neon main branch hostname (not a secret); read by block-unsafe.sh
  rules/
    server.md                      paths: src/server/**, src/app/api/** — action shape, never trust client ids, projection for the public page, caps enforced server-side
    ui.md                          paths: src/app/**/*.tsx, src/components/** — tokens only in both themes, three states per list, shared Pill/EmptyState/ConfirmDialog, no native confirm/select, a11y floor, copy voice per role, banner spec
    db.md                          paths: src/db/**, drizzle/** — schema is law, generate never push, applied migrations are immutable, invariants list, activity stays append-only
    public.md                      paths: src/app/u/**, src/app/api/upload/** — no session assumptions, token resolution, terminal-loan refusal, caps, demo-warning copy
    testing.md                     paths: tests/**, **/*.test.ts — unit for pure modules, db for triggers, e2e for journeys; no snapshot tests; no DB in the Stop hook
  skills/
    phase/SKILL.md                 /phase [n]: prints the phase block and its verify list
    verify/SKILL.md                /verify: biome, tsc, vitest, playwright smoke, axe; summarises failures; run by the coding chat at the end of every step
    add-action/SKILL.md            procedure for one server action: matrix row → zod schema → action → activity → vitest row → run authz-reviewer
    db-reset/SKILL.md              /db-reset: migrate + seed against DATABASE_URL; refuses if the URL contains the prod host
    release/SKILL.md               /release: migrate main, curl smoke on /login and an unauthenticated /api/cron/reset (expects 401), warm Neon. Deploys happen on git push
    design-system/SKILL.md         tokens (both themes), type, sizes, icons, recipes, component rules, copy voice — filled from design/handoff on 2026-09-07; background knowledge
    domain/SKILL.md                mortgage glossary and the "why" behind stages, conditions, public-page limits; points to lib/stages.ts for labels and PLAN.md for the matrix; background knowledge
  agents/
    authz-reviewer.md              read-only: every action/route calls requireActor + can; public page renders only redacted types; activity never updated; caps server-side; authz.ts table has one entry per matrix row and the test is driven by it
    ui-reviewer.md                 read-only: compares a screen with design/handoff/reference and README and the design-system skill; states, both themes, a11y floor, copy voice
    schema-guard.md                read-only: audits migrations and schema against rules/db.md and the invariants; flags edits to applied migrations
    demo-walker.md                 Bash + Playwright MCP (Phase 5): clicks through Section 13 on a URL and reports where it breaks
  scripts/
    phase.sh                       prints one phase block from PLAN.md (active, or by number); used by /phase
  hooks/
    session-start.sh               SessionStart: prints the active phase heading from PLAN.md, the count of uncommitted paths, "run /phase"
    block-unsafe.sh                PreToolUse (Bash): deny recursive deletes (except build caches), history-destroying git, reads/writes of .env files (.env.example exempt), env dumps, drizzle-kit push, any db:*:prod not written exactly as the /release command, shell writes to migrations, and any command naming the host in .claude/prod-db-host; commit messages are blanked before scanning
    protect-files.sh               PreToolUse (Edit|Write): deny edits to existing drizzle/*.sql and to .env*
    format.sh                      PostToolUse (Edit|Write): biome format --write on the touched file
    pre-stop.sh                    Stop: pnpm typecheck (next typegen + tsc) + biome check + vitest run (unit only); exit 2 with the first 40 lines on failure; exits 0 when stop_hook_active is set
    tests/                         fixtures.txt (one command per line, D = must deny, A = must allow) + run.sh; run after any hook change: bash .claude/hooks/tests/run.sh "$PWD"
```

**Hook events used:** `SessionStart`, `PreToolUse` (matchers `Bash` and `Edit|Write`), `PostToolUse` (`Edit|Write`), `Stop`. All command hooks are macOS-safe (bash 3.2, BSD grep, `jq` required), fail open on tooling problems, and block only on real findings.

**Permissions (`settings.json`).** allow: `Bash(pnpm *)`, read-only git (`status`, `diff`, `log`, `show`, `fetch`), the phase-branch flow (`git switch -c phase-*`, `git checkout -b phase-*`, `git push -u origin phase-*`, `git rebase main`, `git pull --ff-only`, `git tag *`), `git add`, `git commit`, `git push`, `gh pr create|view|checks|status|list|ready`, `gh run list|view`, `Bash(vercel logs*)`, `Edit(src/**)`, `Edit(tests/**)`, `Edit(docs/**)`, `Edit(.env.example)`. ask: `Edit(.claude/**)`, `Edit(PLAN.md)`, `Edit(CLAUDE.md)`, `Edit(design/**)`, `Bash(gh pr merge*)`, `Bash(curl *)`, `Bash(vercel *)`. deny: `Read`/`Edit` of `.env`, `.env.local`, `.env.*.local`, `.env.development`, `.env.production`, `.env.test` (never `.env.example`), `Bash(sudo *)`, `Bash(git push --force*)`. Recursive `rm` is governed by the hook (all spellings; build caches excepted), not by a settings rule, because a settings deny cannot express the exception.

**Plugins and MCP.** Playwright MCP via `.mcp.json` (project-scoped, committed, so every clone has it). From the official marketplace, optional and one line each: `security-guidance` (inline nudges while writing server code) and `typescript-lsp` (go-to-definition and diagnostics for the agent). No GitHub or Vercel MCP: `gh` and `vercel` CLIs are enough, and Vercel deploys on push. No agent teams, no worktrees: one developer, one branch.

**Session ritual (in `CLAUDE.md`).** Start: the hook prints the active phase → `/phase n` → propose a short plan → wait for approval. Work: small commits; run `ui-reviewer` after UI work, `authz-reviewer` after server work, `schema-guard` before any migration. End: `/verify` → commit → report what changed, what was verified, and any plan or skill drift. The planning chat owns `.claude/` and `PLAN.md`; the coding chat edits `design-system` and `domain` skills only to fix drift and says so in the commit.

---

## 11. Testing strategy

Minimal but real, one layer per concern.

- **Unit (vitest, no database, runs in the Stop hook in under 10 s):** `authz.test.ts` (table-driven from the matrix, plus impersonated actors and own-vs-any rows), `transitions.test.ts` (every allowed and refused move, reason and gate rules), `analytics-math.test.ts` (pull-through, cycle time, aging buckets, stalled thresholds against fixed rows), `limits.test.ts`, `redactForPublic` field absence.
- **DB (vitest + pglite, run by `/verify`, not the Stop hook):** migrations apply; `UPDATE` and `DELETE` on `activity` throw; one service writes exactly one activity row and rolls back with its change. Drop this layer if it costs more than 30 minutes to set up; verify the trigger by hand instead.
- **End-to-end (Playwright, local against the Neon `dev` branch after `/db-reset`, run by `/verify`):** `login.spec.ts` (three cards land on three homes), `loan-flow.spec.ts` (create → move → withdraw), `public-upload.spec.ts` (fresh context, upload, reject, re-upload, accept, clear; revoked link), `impersonation.spec.ts` (Priya → Sam → banner → act → exit → two rows), `public-scope.spec.ts` (internal-only conditions, borrower email/phone and download URLs absent from the public page's DOM **and** raw response body), `a11y.spec.ts` (axe on login, pipeline, loan detail, queue, public page, dashboard, users, in light and dark; fail on serious and critical), `demo-path.spec.ts` (Section 13 end to end, added in Phase 5).
- **CI (GitHub Actions on push and pull request):** biome, tsc, vitest. Playwright stays local by design. Branch protection on `main` requires a pull request and the CI check; merges are rebase merges so the small step commits survive.
- **Manual:** each phase's 10-minute verify on the production URL, as the real role.
- **Not tested:** markup snapshots, pixel diffs.

---

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Vercel Hobby non-commercial clause | Personal portfolio framing; $20 Pro for a selling month; Cloudflare Workers fallback behind the one-file storage module |
| Blob 2,000 advanced ops per month | Global 40 uploads/day cap, no runtime `list()`, specimens reused across resets, avoid browsing the Blob dashboard |
| Neon cold start after 5 min idle reads as slowness | Login page performs a trivial query on render; pre-warm before demos; no retry wrappers that hide real errors; no keep-alive pinger |
| Neon 100 CU-hours/month | Polling only while the tab is visible and stops after 10 idle minutes; local dev on the `dev` branch is fine (a 3-hour session ≈ 0.75 CU-hours) |
| Hobby cron fires ±59 min, may skip or double-fire | Reset is idempotent; superadmin button is the manual path; nothing depends on exact timing |
| Better Auth impersonation quirks (session expiry after stop, cookie prefix, server-side headers) | Default cookie prefix; server calls always pass `headers`; `impersonation.spec.ts` covers the full round-trip |
| Strangers abuse the public URL | Caps, size and type limits, terminal-loan refusal, daily purge, synthetic-only data, no email |
| Public page leaks staff-only data | Query-level projection, distinct redacted type, `authz-reviewer` on every server change, raw-body assertion in `public-scope.spec.ts` |
| Dark mode contrast regressions | Tokens only, no raw colours; axe in both themes in `a11y.spec.ts`; `ui-reviewer` checks both |
| Agent edits an applied migration or hits production | `protect-files.sh`, `block-unsafe.sh` with the prod host file, `schema-guard`, `db-reset` refuses prod |
| Scope creep back toward a borrower portal, realtor portal, realtime, drag-and-drop or AI | Must list frozen at 12; new ideas go to `docs/DECISIONS.md` as Should or Stretch via the planning chat |
| Design–code drift | Tokens transcribed once; `ui-reviewer` after every screen; artboards are references, not sources |

---

## 13. Demo script (5–6 minutes)

1. **Login (20 s).** "Three roles, one loan file, one superadmin who can be anyone. Everything is synthetic and resets nightly."
2. **Priya, superadmin (60 s).** Enter as Priya. Dashboard: pipeline by stage, funded this month, pull-through, needs attention. Users → View as Alex. The amber banner appears.
3. **As Alex, loan officer (90 s).** Pipeline. New loan "Chen · 412 Maple Ave", $485,000, conventional purchase. Move it to Application, then to Processing. Open the loan: six needs-list items were created. Copy Maria's link.
4. **Maria, borrower, phone or private window (60 s).** "No account, no app to install." Upload the specimen pay stub against Pay stubs. Status flips to "Received, under review".
5. **Exit view → View as Sam, processor (90 s).** Queue shows the upload. Reject: "Only one stub; we need 30 days." Maria's page: "Needs another: …". Re-upload, accept, "Clear this condition?" → yes. Submit to underwriting → Issue conditional approval. Point at the tooltip.
6. **Exit view, back as Priya (45 s).** Loan Activity tab: "Priya Nair (viewing as Sam Okafor) rejected Pay stubs …". Activity page filtered to impersonation. "Append-only, enforced in the database, impersonation is honest." Flip to dark mode. Close on the Needs attention table.
7. **Optional for engineering audiences (30 s).** `CLAUDE.md`, the `.claude/` tree, `limits.ts`, the Stop hook: "plan, small verified diffs, reviewer agents, a hook that refuses to end a turn on a broken build."

---

## 14. Decisions log (resolved 2026-09-06)

| # | Decision | Outcome |
|---|---|---|
| 1 | App name | **Clearline** |
| 2 | Borrower access | **Public tokenized link, no login** |
| 3 | Role views | **Loan officer, Processor, Borrower page**, plus Superadmin as the front door for every visitor. Realtor moved to Stretch |
| 4 | Hosting | **Vercel Hobby + Neon Free + Vercel Blob**; laptop for dev only; Cloudflare Workers as the written fallback |
| 5 | Superadmin on a public URL | **Open card, leads the login page**; no real users exist |
| 6 | AI document suggestion | **Dropped** (Stretch); no LLM calls, no API key |
| 7 | Phase 1 timing | **Non-UI work starts in parallel with Claude Design**; screens wait for the green signal |
| 8 | Theme | **Light and dark**, system default, toggle in the persona chip |
| 9 | Local database | Neon `dev` branch, no Docker (Docker Postgres optional for offline work) |
| 10 | Drag-and-drop | Stretch; "Move to…" menu is the shipped path |
| 11 | Live updates | 30 s visible-tab polling as Should; no websockets |
| 12 | Reset schedule | Daily 08:00 UTC plus the superadmin button |
| 13 | URL | `clearline-gilt.vercel.app` (Vercel project `clearline`) |
| 14 | `demo-los-kit/` | Archived under `docs/archive/demo-los-kit/` (done 2026-09-06; files renamed so no nested `CLAUDE.md` or `.claude/` loads) |
