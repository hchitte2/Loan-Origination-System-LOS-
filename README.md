# Clearline

A demo loan origination system ("CRM for LOS") for a small US mortgage shop: a loan officer works a pipeline, a processor collects and reviews documents against a needs list, a borrower uploads documents through a public link with no login, and a superadmin sees everything and can step into any user's shoes.

Portfolio-grade and deliberately small: production craft at demo scope, synthetic data only, $0/month to run.

**Status:** Phase 0 (repo, tooling, guardrails, placeholder deploy). `PLAN.md` is the spec and records every decision.

## What it will do

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
| Vercel Blob | 2,000 "advanced operations" per month, so uploads are capped at 40 per day globally and 10 per loan, the app never calls `list()` at runtime, and seed specimens are uploaded once and reused across resets |

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
docs             decisions parking lot, demo script, runbook
.claude          rules, skills, agents and hooks for the Claude Code workflow
```

## Built with Claude Code

The repository doubles as a worked example of an agentic workflow: `CLAUDE.md` holds the rules, `.claude/` holds path-scoped rules, skills, read-only reviewer agents and hooks. A Stop hook refuses to end a turn on a broken build; a PreToolUse hook denies destructive commands and anything that names the production database.

## Data

All data is synthetic: `@example.com` emails, fictional addresses, no SSN, date of birth, income or credit fields anywhere. Do not upload real personal documents to the demo.
