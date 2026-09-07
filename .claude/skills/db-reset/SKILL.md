---
name: db-reset
description: Reset the development database (apply migrations, reseed the fixture) against DATABASE_URL, refusing production. Use before Playwright runs or when seed data looks stale.
allowed-tools: Bash(pnpm db:*), Bash(pnpm seed:*), Read
---

1. `pnpm db:reset` runs migrate + seed. The script itself must read `DATABASE_URL`, compare the host with `.claude/prod-db-host`, and exit non-zero on a match unless `CLEARLINE_RELEASE=1` is set. If the script does not implement that guard yet, add it first (see `.claude/rules/db.md`).
2. Run it. Never pass a different `DATABASE_URL` inline and never prefix it with `CLEARLINE_RELEASE=1`; that is what `/release` is for.
3. If seed specimens are missing from Blob (the seed prints a warning), run `pnpm seed:files` once; it uploads the three specimen PDFs to `seed/*` and is idempotent.
4. Report the counts the seed prints (users, loans by stage, conditions, documents, activity rows) and the showcase link path `/u/<DEMO_SHOWCASE_TOKEN>` without printing the token value itself.
