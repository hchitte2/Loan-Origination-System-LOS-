---
name: verify
description: Run the full local verification (biome, tsc, unit tests, db tests, Playwright journeys with axe in both themes) and summarise what failed. Use before ending a phase step or when asked to verify.
allowed-tools: Bash(pnpm *), Bash(ls *), Bash(test *), Bash(git status*), Read
---

Run these in order. If a step is not configured yet, report "not configured" and continue; never skip a step that exists.

1. `pnpm check` — biome + tsc + unit vitest.
2. `pnpm test:db` — only if `package.json` defines it.
3. `pnpm e2e` — only if `playwright.config.*` exists. It starts the dev server against the Neon `dev` branch. If fixtures look stale (unexpected counts, missing showcase loan), run `/db-reset` first and say so in the report.
4. Accessibility is part of step 3 (`a11y.spec.ts`, light and dark). Call out any serious or critical axe violation separately.

Then report:

| Step | Result | First failure |
|---|---|---|

followed by the active phase's done-when list (from `/phase`) with a check or cross per item you can prove from the run or from what you verified in the browser this session.

Do not fix anything inside this skill. List what to fix, most important first, then stop.
