---
paths:
  - "tests/**"
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "vitest.config.*"
  - "playwright.config.*"
---
# Testing rules

Three layers, each with one job. Do not duplicate a check across layers.

## Unit (vitest, `tests/unit`, no database, under 10 s; runs in the Stop hook via `pnpm test`)
- `authz.test.ts`: table-driven from `POLICY` in `authz.ts`, one case per role × action that matters, plus impersonated actors and own-vs-any rows, plus `redactForPublic` field absence.
- `transitions.test.ts`: every allowed and refused move, reason requirements, clear-to-close and funded gates.
- `analytics-math.test.ts`: pull-through, cycle time, aging buckets, stalled thresholds against fixed rows with fixed dates.
- `limits.test.ts`: caps at the boundary.
- Pure modules only. If a test needs the database, it belongs in the db layer.

## DB (vitest + pglite, `tests/db`, run by `/verify` via `pnpm test:db`)
- Migrations apply from scratch; `UPDATE`/`DELETE` on `activity` throw; one service call writes exactly one activity row and rolls back together with its change.
- Keep this layer small. If pglite setup fights back for more than 30 minutes, drop it and verify the trigger by hand.

## End-to-end (Playwright, `tests/e2e`, local dev server against the Neon `dev` branch after `/db-reset`; run by `/verify` via `pnpm e2e`)
- One spec per journey, named after PLAN.md §11: `login`, `loan-flow`, `public-upload`, `impersonation`, `public-scope`, `a11y`, `demo-path` (Phase 5).
- Log in through the persona cards, never by typing passwords in tests.
- `public-scope.spec.ts` asserts hidden fields are absent from the DOM **and** from the raw response body (`page.request.get(url).text()`), because Server Components serialise what they fetch.
- `a11y.spec.ts` runs `AxeBuilder` on each top-level route in light and dark (`page.emulateMedia({ colorScheme })` plus the class toggle) and fails on serious and critical violations.
- Use role-based locators (`getByRole`, `getByLabel`); no CSS selectors tied to styling. Deterministic waits (`expect(...).toBeVisible()`), never `waitForTimeout`.
- Tests read fixture facts (names, amounts, the showcase token) from `src/db/seed.ts` exports; no magic strings.

## Never
- Snapshot tests of markup. Pixel diffs. Tests that depend on today's date without freezing it. Skipped tests left in the tree.
