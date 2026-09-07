# Decisions and parking lot

Resolved decisions live in PLAN.md §14. This file is the parking lot for ideas that are **not** in the Must list. Anything here needs a PLAN.md change by the planning chat before a coding session may build it.

## Should (after the Must list runs clean on the production URL)
- Visible-tab polling (30 s, stops after 10 idle minutes) on loan detail, queue and the public page.
- Leaderboard tile (loan officer production) on the superadmin dashboard.
- Global loan search (⌘K).

## Stretch
- Realtor / referral-partner portal: own referred loans, milestones and dates only, "What you can see here" note, 404 for foreign loans. Would add a `realtor` role, `realtor_id` on loans, `(partner)/clients` routes.
- Drag-and-drop on the pipeline board with dnd-kit (keyboard sensor, announcements); the "Move to…" menu stays as the accessible path.
- AI document suggestion via the Claude API (suggests `doc_type` and condition, human confirms, feature-flagged, daily cap, cheap model). Dropped on 2026-09-06 to keep the demo free of API keys.
- Realtime via Ably free tier for the split-screen moment.
- Borrower login and application wizard.
- Pre-approval letter PDF, CSV export of the pipeline, magic-link invites, per-IP rate limits, `SUPERADMIN_PASSPHRASE` gate on the superadmin card, custom domain.

## How to add an idea
One bullet: what, who benefits, rough cost in sessions. The planning chat triages it into Should or Stretch, or into a phase.
