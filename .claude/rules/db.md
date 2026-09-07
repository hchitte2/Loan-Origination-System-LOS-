---
paths:
  - "src/db/**"
  - "drizzle/**"
  - "drizzle.config.*"
---
# Database rules

## Source of truth
- `src/db/schema.ts` is the schema. PLAN.md §6 is the spec it implements; if they disagree, say so and propose the plan change rather than drifting silently.
- Enums are declared once in `schema.ts` (`pgEnum`) and mirrored with labels in `src/lib/stages.ts` and `src/lib/doc-types.ts`. Never a third copy.
- Never guess a column name; read `schema.ts`.

## Migrations
- Flow: edit `schema.ts` → `pnpm db:generate` → read the generated SQL → run `schema-guard` → `pnpm db:migrate` (dev) → tests → commit the SQL and `drizzle/meta` together.
- Hand-written SQL (triggers, indexes drizzle cannot express) goes in a custom migration created by `pnpm db:generate --custom`, edited before it is committed.
- Committed migrations are immutable (a hook enforces it). Fix forward with a new migration.
- Never `drizzle-kit push`. Never run migrate, seed or reset against production except via `/release`.
- Drivers: `drizzle-orm/neon-serverless` (WebSocket `Pool`) when `process.env.VERCEL` is set, `pg` otherwise. Both are chosen in `src/db/index.ts`; nothing else under `src/` imports a driver. `tests/db` builds its own `drizzle-orm/pglite` instance over the shared `schema.ts`; pglite never enters `src/`. The HTTP driver is never used (no transactions).

## Invariants the schema and services must keep (PLAN.md §6)
1. Stage moves: one step forward or back among the six active stages; `withdrawn`/`denied` need `closed_reason`; `funded` only from `clear_to_close`, sets `funded_at`; terminal stages never move; entering `application` sets `application_date` if empty; every move writes `loan.stage_changed` and resets `stage_entered_at`.
2. `clear_to_close` requires no open (`requested`/`received`) condition with `prior_to` in (`approval`, `docs`); `funded` requires every condition `cleared` or `waived`.
3. A document registered against a `requested` condition moves it to `received`; rejecting needs `review_reason` and, if no accepted document remains, moves the condition back to `requested` with `last_rejection_reason`; clearing needs one accepted document or an explicit waive with a reason.
4. Exactly one `activity` row per mutation, in the same transaction, with `actor_id`, `on_behalf_of`, `actor_kind`.
5. Public uploads only against `borrower_facing` conditions of non-terminal loans with a live `upload_token`.
6. `activity` is append-only: `BEFORE UPDATE OR DELETE` triggers raise. No code path updates or deletes it. Only the reset's `TRUNCATE` bypasses this, and the README says so.
7. No SSN, DOB, income, credit, DTI or protected-class columns exist anywhere.

## Seed and reset
- `src/db/seed.ts` is deterministic (fixed seed for any random generator) and relative to `new Date()` so dashboards are populated on any day. Shape: PLAN.md §6 "Seed fixture".
- The same module implements the reset: delete user-uploaded blobs by recorded pathname → `TRUNCATE` app tables → reseed → write one `demo.reset` activity row. Idempotent: running it twice yields the same state.
- Seed specimens live at Blob paths `seed/*` and are uploaded once by `pnpm seed:files`; the reset never deletes them.
- `pnpm db:reset`, `db:seed`, `db:migrate` and their `:prod` variants (`db:migrate:prod`, `db:seed:prod`) read `DATABASE_URL`, compare its host with `.claude/prod-db-host`, and exit non-zero on a match unless `CLEARLINE_RELEASE=1` is set. Implement the guard once in one shared script entry point; the `:prod` scripts load `.env.production.local` and then call the same guarded entry point, never a bare `drizzle-kit migrate`. The hook only sees command strings and never sees the host inside `pnpm db:*:prod`.

## Queries
- Drizzle query builder everywhere; raw SQL only inside migrations and for analytics aggregates (parameterised).
- Indexes exist for every column used in a `where` or `order by` on a hot path (`stage`, `loan_officer_id`, `upload_token`, `target_close_date`, `(loan_id, created_at)`, `(action, created_at)`).
- Every read of loans goes through `loanScope(actor)`; no query returns rows outside the caller's scope.
