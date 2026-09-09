# Clearline

A demo loan origination system ("CRM for LOS") for a small US mortgage shop: a loan officer works a pipeline, a processor collects and reviews documents against a needs list, a borrower uploads documents through a public link with no login, and a superadmin sees everything and can step into any user's shoes.

Portfolio-grade and deliberately small: production craft at demo scope, synthetic data only, $0/month to run.

**Status:** complete through Phase 5 — pipeline, needs list, borrower page, dashboards, demo reset. `PLAN.md` is the spec and records every decision.

## What it does

- Pipeline board by stage, loan record, conditions and documents (the needs list)
- Per-loan public upload link for the borrower, no account required
- Three distinct views (loan officer, processor, borrower page) plus a superadmin who can "View as" anyone
- Append-only audit log enforced by database triggers, recording who really acted while impersonating
- Role-scoped analytics, light and dark themes, WCAG 2.2 AA
- Deterministic seed and a daily reset, so the public demo is always in a known state

## Non-goals

Stated up front so nobody looks for them: borrower login and the 1003/URLA application wizard, realtor portal, credit pull, automated underwriting, pricing and rate locks, disclosures (LE/CD), e-signature, appraisal and title ordering, closing package, funding wire, servicing, email or SMS sending, multi-tenant organisations, websockets, AI document classification, a mobile app, referral payouts.

Two deliberate simplifications a reviewer should know about:

- **Single tenant, one application role.** Authorization lives in one testable TypeScript module (`src/server/authz.ts`, transcribed from the permission matrix in `PLAN.md`) rather than Postgres row-level security.
- **The audit log is append-only by trigger.** `UPDATE` and `DELETE` on `activity` raise. The only thing that bypasses row triggers is the demo reset's `TRUNCATE`, and that is the point of the reset.

## Hosting: how it stays free

Everything runs online on **Vercel Hobby + Neon Free + Vercel Blob**; the laptop is for development only.

| Piece | Free tier fact that shaped the design |
|---|---|
| Vercel Hobby | 4.5 MB request body, so uploads go browser-direct to Blob; one cron a day, fired within ±59 minutes; personal, non-commercial use, which is what a portfolio demo is |
| Neon Free | Compute scales to zero after five idle minutes and wakes in a few hundred milliseconds; no keep-alive pinger, because a 24/7 poller would burn the monthly compute budget. Local development uses the `dev` branch, production uses `main` |
| Vercel Blob | 2,000 "advanced operations" per month, so uploads are capped at 40 per day globally and 10 per loan, and seed specimens are uploaded once and reused across resets. `list()` is a *basic* operation, so the two places that use it — counting the day's uploads, and sweeping unregistered files during the reset — cost nothing against that budget |

Fallback if Vercel ever objects: Cloudflare Workers via OpenNext. Neon, the schema and the code stay; storage swaps behind the one-file storage module.

## Stack

Next.js 16 (App Router, Server Components and Server Actions), React 19, TypeScript 5.9, Tailwind 4 + shadcn/ui, Drizzle ORM with SQL migrations on Neon Postgres, Better Auth with the admin plugin for impersonation, Vercel Blob (private, client uploads), zod 4, Biome, vitest, Playwright + axe. pnpm and Node 22.

Not used on purpose: TanStack Query, RLS, websockets, LLM calls, drag-and-drop libraries, Docker.

## Running it locally

```sh
pnpm install
cp .env.example .env.local   # fill in the values; DATABASE_URL points at the Neon dev branch
pnpm dev
```

| Command | What it does |
|---|---|
| `pnpm check` | Biome, `tsc` and the unit tests, the same gate CI runs |
| `pnpm test` / `pnpm test:db` | Unit tests (pure modules) / database tests |
| `pnpm e2e` | Playwright journeys against the local dev server |
| `pnpm db:generate` | Write a new migration from `src/db/schema.ts` |
| `pnpm db:migrate` / `db:seed` / `db:reset` | Apply migrations, seed, or reset the `dev` database |
| `pnpm seed:files` | Upload the specimen documents to Blob once |

Every `db:*` script goes through `src/db/cli.ts`, which compares the `DATABASE_URL` host with `.claude/prod-db-host` and refuses to touch production unless run through the release procedure. Committed migrations are never edited; `drizzle-kit push` is never used.

## Repository map

```
src/app          routes only (staff group, public borrower page, API route handlers)
src/server       authz, actor, transitions, activity, limits, storage, queries, actions
src/db           Drizzle schema, client, seed and reset, guarded CLI
src/lib          stages and labels, document types, analytics math, format, env
src/components   shadcn primitives and the shared Clearline components
tests            unit / db / e2e
drizzle          committed SQL migrations
design           Claude Design brief and reference exports (reference only, never imported)
docs             decisions parking lot (the demo script and runbook are in this file)
.claude          rules, skills, agents and hooks for the Claude Code workflow
```

## The demo, in five minutes

Six seeded staff accounts, and no passwords typed: the login screen carries a card for the three the script uses. Everything is synthetic, and the whole database is restored every morning at 08:00 UTC.

1. **Login.** Three roles, one loan file, one superadmin who can be anyone.
2. **Priya, superadmin.** The dashboard: pipeline by stage, funded this month, pull-through, and the files that need a decision today. Users → **View as Alex**; the amber banner appears and the superadmin's own navigation disappears.
3. **As Alex, loan officer.** Pipeline → **New loan**, $485,000, conventional purchase. Move it to Application, then Processing — always through the stage machine, never by setting a column. Opening the loan shows the six needs-list items that creating it generated. Copy Maria's link.
4. **Maria, borrower**, on a phone or in a private window. No account, no app to install. She uploads a pay stub; the item flips to "Received, under review". She never sees a stage name or the word "pending".
5. **Exit view → View as Sam, processor.** The queue has the upload. Reject it: *"Only one stub; we need 30 days."* Maria's page now reads **"Needs another: only one stub…"**. She sends another; Sam accepts it and is asked whether the condition itself is done. Submit to underwriting → issue conditional approval.
6. **Exit view, back as Priya.** The loan's Activity tab reads **"Priya Nair (viewing as Sam Okafor) rejected Pay stubs"** — the log records the human, not the costume. The activity page filters to impersonation. Flip to dark mode. Close on the Needs attention table.
7. **For engineering audiences.** `CLAUDE.md`, the `.claude/` tree, `src/server/limits.ts`, and the Stop hook: plan, small verified diffs, reviewer agents, and a hook that refuses to end a turn on a broken build.

`tests/e2e/demo-path.spec.ts` walks this exact path end to end, so a change that breaks the demo breaks CI first. One deliberate difference: the spec creates its loan at a different address, because the script's "412 Maple Ave" is the address the seed fixture already uses for its showcase loan — type it live and you get two identical rows on the pipeline.

## Resetting the demo

The fixture is restored three ways, all of which run the same code in `src/server/reset.ts`: read the uploaded blob pathnames out of `documents`, delete those blobs, sweep any from a previous day that no row ever named, then truncate and reseed relative to today. It is idempotent — running it twice leaves exactly what running it once leaves.

| How | When |
|---|---|
| `vercel.json` cron → `GET /api/cron/reset` | 08:00 UTC daily, authorized by `Authorization: Bearer $CRON_SECRET` and nothing else |
| "Reset demo data" on the activity log | Superadmin only, behind a confirm, at most once every ten minutes |
| `pnpm db:reset` | Locally, against the Neon `dev` branch |

Blobs are deleted before the truncate on purpose: the reseed empties the table that names them, so the other order would orphan every remaining object with no record of its pathname. `seed/` — the three specimen PDFs the fixture points at — is never touched, so reseeding costs no uploads.

## Releasing

Deploys happen on push to `main`; production is Vercel + the Neon `main` branch. Only the `/release` procedure touches production data, and `src/db/cli.ts` refuses the production host unless `CLEARLINE_RELEASE=1` is set.

1. **Pre-flight.** Working tree clean, on `main`, everything pushed, CI green, `/verify` green.
2. **Environment.** `vercel env pull .env.production.local --environment production`. **Vercel marks the six app secrets Sensitive, so this writes blanks for them** — paste those values into the file by hand before the next step, or the migration runs against nothing. The six exist only in the Production environment; preview deployments do not have them, which is why a preview answers 401 on the cron route.
3. **Migrate.** `CLEARLINE_RELEASE=1 pnpm db:migrate:prod`. Seed only on a first release or when the fixture itself changed: `CLEARLINE_RELEASE=1 pnpm db:seed:prod`.
4. **Smoke.** `/login` returns 200, `/api/cron/reset` returns 401 without the secret, and signing in as Priya renders the dashboard with numbers — which also wakes Neon before anyone watches.

Committed migrations are never edited and `drizzle-kit push` is never used; `pnpm db:generate` writes a new migration instead.

## Built with Claude Code

The repository doubles as a worked example of an agentic workflow: `CLAUDE.md` holds the rules, `.claude/` holds path-scoped rules, skills, read-only reviewer agents and hooks. A Stop hook refuses to end a turn on a broken build; a PreToolUse hook denies destructive commands and anything that names the production database.

## Data

All data is synthetic: `@example.com` emails, fictional addresses, no SSN, date of birth, income or credit fields anywhere. Do not upload real personal documents to the demo.
