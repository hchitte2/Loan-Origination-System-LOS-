# {{APP_NAME}} · Project rules for Claude Code

A demo loan origination system. Portfolio project; the bar is "production
craft at demo scope". Read ROADMAP.md for the full plan; the current phase's
block is the active spec.

## How we work

- **Plan first.** For any non-trivial task, propose a short plan and wait for
  approval before writing code.
- **Small commits.** One finished step per commit, conventional style
  (`feat(portal): needs-list upload zone`). Never one giant commit.
- **Verify before done.** Open the app in the browser as the affected role and
  use the feature. "Compiles" is not "works".
- **Root cause over patch.** If data comes back empty or a state looks wrong,
  find out why; never hide it behind a fallback.

## Skills (read the matching one before working)

- `.claude/skills/design-system.md`: tokens, page skeleton, component rules.
  Every UI task starts here. No hex values or spacing outside the tokens.
- `.claude/skills/data-model.md`: the schema truth, RLS intent, lifecycle
  states, naming. Every query/migration task starts here.
- If a skill and the code disagree, fix the skill in the same session.

## Agents and hooks

- `design-reviewer` agent: run it on any screen you just built or restyled,
  before calling the task done.
- `schema-guard` agent: run it on any migration or data-hook change before
  applying or merging.
- A Stop hook runs `tsc --noEmit`: you cannot end a turn on a type-broken
  tree. Fix the errors it hands back; never silence them with `as any`.

## Hard rules

- Everything a user creates must be editable, deletable, and undoable, or the
  ROADMAP records why not.
- Every list/detail screen ships designed loading, empty, and error states.
- Roles: `loan_officer`, `processor`, `borrower`. Authorization is enforced by
  RLS in Postgres, then mirrored in the UI. Never trust the client.
- The borrower never sees system vocabulary (stage enums, review_status
  values). Borrower-facing copy is warm and plain.
- `activity` is append-only. Every meaningful action writes a row.
- Secrets only in env / `supabase secrets`. Never in code, never committed.
- All server state through TanStack Query; no hand-rolled useEffect fetching.

## Stack facts

- React + TypeScript + Vite + Tailwind + shadcn/ui.
- Supabase: Auth, Postgres + RLS, Storage, Edge Functions, Realtime.
- One LLM edge function (`suggest-document`) calls the Claude API with
  structured output; it degrades gracefully when the key is missing.
- Tests: vitest for hooks/components where logic warrants; a smoke Playwright
  script for the demo path once Phase 4 lands.
