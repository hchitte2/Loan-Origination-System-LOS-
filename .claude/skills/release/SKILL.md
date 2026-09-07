---
name: release
description: Production release checklist for Clearline: CI green, migrate the Neon main branch, smoke-test the Vercel URL, warm Neon. The only sanctioned way to touch production. Deploys themselves happen on git push.
disable-model-invocation: true
allowed-tools: Bash(git status*), Bash(git log*), Bash(git branch*), Bash(gh run *), Bash(pnpm *), Bash(curl *), Bash(vercel inspect*), Bash(vercel logs*), Read
---

## Pre-flight (all must hold, otherwise stop and report)
- `git status --porcelain` is empty, the branch is `main`, and `git log origin/main..main` is empty (everything pushed).
- `gh run list --limit 1` shows the latest CI run succeeded.
- `/verify` was green in this session.
- The user confirms this release in the conversation (a release is outward-facing).

## Migrate production (visible, marked)
- `CLEARLINE_RELEASE=1 pnpm db:migrate:prod`. The script loads the production `DATABASE_URL` from `.env.production.local`, which the user pulls with `vercel env pull .env.production.local --environment production`. Never read that file yourself. The PreToolUse hook allows exactly these two commands, written exactly like this, and denies every other form of `db:*:prod`; the scripts themselves also refuse the production host unless `CLEARLINE_RELEASE=1` is set.
- Seed production only on the first release or when the user asks: `CLEARLINE_RELEASE=1 pnpm db:seed:prod`.

## Smoke (production URL from `vercel inspect` or from the user)
- `curl -s -o /dev/null -w '%{http_code}' <url>/login` → expect 200.
- `curl -s -o /dev/null -w '%{http_code}' <url>/api/cron/reset` → expect 401 (unauthenticated must be refused).
- Open `<url>/login` with the Playwright MCP, enter as Priya, confirm the dashboard renders with numbers. This also warms Neon.

## Report
Migration output summary, the three smoke results, and anything the user must do (env vars missing, cron not yet scheduled, first reset time).
