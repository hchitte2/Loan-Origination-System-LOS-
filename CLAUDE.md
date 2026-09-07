# Clearline · project rules for Claude Code

A demo loan origination system ("CRM for LOS") for the US mortgage industry. Portfolio-grade: production craft at demo scope. `PLAN.md` is the spec; the phase marked `Status: active` is the current work. `PLAN.md` and `.claude/` are owned by the planning chat: propose changes to them in your end-of-phase summary instead of editing them (edits there prompt for permission on purpose).

## Session ritual
1. The SessionStart hook prints the active phase. Run `/phase` for its full block and read it before anything else.
2. For any non-trivial task, propose a short plan and wait for approval.
3. Build in small steps. One finished step per commit, conventional style (`feat(pipeline): move-to menu`). Never one giant commit.
4. Verify in the browser as the affected role (the Playwright MCP is configured) before calling anything done. "Compiles" is not "works".
5. Run the matching reviewer before finishing: `ui-reviewer` after UI work, `authz-reviewer` after anything in `src/server/` or `src/app/api/`, `schema-guard` before any migration.
6. End with `/verify`, then a summary: what changed, what was verified, and any drift between the code and `PLAN.md` or a skill.

## Git workflow
- `main` is always deployable; Vercel production builds from it. After Phase 0, nothing is committed to `main` directly.
- One branch per phase, cut from `main`: `phase-N-<slug>` (for example `phase-1-foundation`). Create it when the phase starts; push it after the first commit so CI and the Vercel preview run.
- Commit per finished, verified step: conventional prefix and scope (`feat(pipeline): move-to menu`), imperative subject under 72 characters, a body that says why when it is not obvious. Never bundle unrelated changes. Never commit secrets, `.env*`, caches or build output.
- Open the PR early as a draft (`gh pr create --draft --fill`), fill in `.github/PULL_REQUEST_TEMPLATE.md`, and mark it ready when the phase's done-when list is green.
- Merge only with CI green and `/verify` passed, as a rebase merge so the small commits survive: `gh pr merge --rebase --delete-branch`. Then `git switch main && git pull --ff-only`, and tag the phase: `git tag -a phase-N -m "Phase N: <title>" && git push origin phase-N`.
- Never force-push, rewrite published history or reset shared branches (the hook blocks these). If `main` moved, rebase your branch on it and push normally.
- Commits and PRs carry the harness attribution trailer and footer.

## Commands (pnpm)
`dev` · `check` (biome + tsc + unit tests) · `typecheck` · `test` (unit only, fast) · `test:db` · `e2e` · `db:generate` · `db:migrate` · `db:seed` · `db:reset` · `seed:files` · `db:migrate:prod` and `db:seed:prod` (only via `/release`)

## Stack facts
Next.js 16 App Router (Server Components + Server Actions, `proxy.ts`), React 19, TypeScript 5.9, Tailwind 4 + shadcn/ui + Recharts 3, next-themes, Drizzle + Neon Postgres (`neon-serverless` on Vercel, `pg` locally), Better Auth 1.7 with the admin plugin (impersonation), Vercel Blob private store, zod 4, pnpm, Biome, vitest, Playwright + axe. Hosting: Vercel Hobby + Neon Free + Blob. Local DB: the Neon `dev` branch. Not used on purpose: TanStack Query, RLS, websockets, LLM calls, dnd-kit, Docker.

## Module map (dependencies flow one way)
`src/app` (routes only) → `src/server/actions` (thin) → `src/server/queries` and `src/server/{authz,transitions,activity,limits,storage}` → `src/db`, `src/lib`. `src/lib` imports nothing from `src/server`. Full tree: PLAN.md §5.

## Hard rules
- Authorize in every Server Action, route handler, page and layout: `requireActor()` then `can()`. Server Actions accept direct POSTs; a hidden button is never the control. The role × action table in `src/server/authz.ts` is transcribed from PLAN.md §2 and drives `authz.test.ts`.
- One activity row per mutation, written by `logActivity()` inside the same transaction. `activity` is append-only (database triggers). Record `actor_id` (the human) and `on_behalf_of` (the impersonated user, if any).
- The public page renders only `redactForPublic()` output. Never fetch everything and hide it in the component; Server Components serialise what they fetch.
- Stage moves go through `transitions.ts`. Never set `loans.stage` directly.
- Uploads: browser → Blob (private, client upload) → `registerDocument` / `registerPublicDocument` action, which re-checks auth and the `uploads/<loanId>/` prefix. Caps live in `limits.ts` and are enforced server-side.
- UI: tokens only, in both themes; no raw colours or one-off spacing. Every list and detail has designed loading, empty and error states. Shared `Pill`, `EmptyState`, `ConfirmDialog`; no `window.confirm`, no native `select` or date inputs where a styled component exists. Staff copy is compact and precise; borrower copy is warm and plain; buttons say what happens.
- Stage labels come from `src/lib/stages.ts` only. The borrower never sees an enum value.
- Never edit a committed migration; `pnpm db:generate` creates a new one. Never `drizzle-kit push`. Never run seed, reset or migrate against production except through `/release`.
- Secrets only in env; never `NEXT_PUBLIC_`; never read or print `.env*`.
- Synthetic data only: `@example.com` emails, fictional addresses, no SSN/DOB/income/credit fields anywhere.
- Root cause over patch: if data comes back empty or a state looks wrong, find out why; never hide it behind a fallback.
- Type and lint errors are fixed, never silenced. An `as any`, `@ts-ignore` or `biome-ignore` needs a one-line reason in the commit message.

## Skills, rules, agents
- Path-scoped rules load automatically: `.claude/rules/{server,ui,db,public,testing}.md`.
- Background skills: `design-system` (tokens, component rules, copy voice), `domain` (mortgage vocabulary and why the rules exist).
- Procedures: `/phase [n]`, `/verify`, `/db-reset`, `/release`, and `add-action` (how to add one server action end to end).
- Agents: `authz-reviewer`, `ui-reviewer`, `schema-guard` (all read-only), `demo-walker` (Phase 5, drives the browser).

## Hooks you will feel
- Stop: `tsc`, `biome check` and unit tests must pass before a turn can end.
- PreToolUse: destructive git and rm commands, `.env` reads, `drizzle-kit push`, and any command naming the production database host are denied. Edits to committed migrations and `.env*` are denied.
- PostToolUse: Biome formats every file you edit.
- Emergency bypass belongs to the user, in `.claude/settings.local.json`. Do not add one yourself.

## Scaffold note (Phase 0 only)
`create-next-app` refuses a non-empty directory. Scaffold into `.scaffold-tmp/`, move its contents to the repo root (keep `.git`, `PLAN.md`, `CLAUDE.md`, `.claude/`, `.mcp.json`, `design/`, `docs/`), merge `.gitignore`, then delete `.scaffold-tmp/`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
