---
name: design-system
description: Clearline's visual system, transcribed from the approved Claude Design handoff: colour tokens for light and dark, type scale, sizes, spacing, shadows, icon mapping, pill recipes, component rules and copy voice per role. Loaded automatically for any UI work.
user-invocable: false
---

# Design system · Clearline

Source of truth: `design/handoff/tokens.md` (values) and `design/handoff/README.md` (screen-by-screen spec), approved 2026-09-07. Pixel targets: `design/handoff/reference/*.png` (27 frames at 2×). `design/handoff/html/` is a reference build, never copied into the app; `html/data.js` holds the exact sample data for `src/db/seed.ts`. This file is law: if a screen needs something the system lacks, propose the extension here first, then use it.

## Colour tokens

Declared once in `src/app/globals.css`: `:root` holds light, `.dark` holds dark, `@theme inline` maps each to Tailwind (`bg-background`, `text-muted-foreground`, …). Components never use a raw colour.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `background` | `#f7f7f8` | `#141518` | page |
| `foreground` | `#18181b` | `#ececee` | primary text |
| `muted` | `#efeff1` | `#24262b` | panels, table header, neutral pills, disclosure boxes |
| `muted-foreground` | `#64687a` | `#9b9fa8` | secondary text, neutral pill text |
| `card` | `#ffffff` | `#1c1d21` | cards, sidebar, table surface, dialogs |
| `card-foreground` | `#18181b` | `#ececee` | text on cards |
| `border` | `#e4e4e7` | `#2e3036` | hairlines |
| `primary` | `#0f766e` | `#2aa393` | primary buttons, active nav, links, milestone tracker, upload-zone dashes |
| `primary-foreground` | `#ffffff` | `#07201d` | text on primary |
| `success` | `#15803d` | `#4ade80` | cleared, accepted, funded |
| `success-foreground` | `#ffffff` | `#052e16` | text on solid success |
| `warning` | `#b45309` | `#fbbf24` | received / under review, stalled, needs review |
| `warning-foreground` | `#ffffff` | `#1c1400` | text on solid warning |
| `destructive` | `#b91c1c` | `#f87171` | rejected, denied, delete, closing-soon risk |
| `destructive-foreground` | `#ffffff` | `#2a0a0a` | text on solid destructive |
| `ring` | `#0f766e` | `#2dd4bf` | focus ring |
| `chart-1` | `#b3c2bf` | `#5b6664` | Lead |
| `chart-2` | `#8fd3c9` | `#3f8f85` | Application |
| `chart-3` | `#4fb8ab` | `#4fb8ab` | Processing |
| `chart-4` | `#2a9d90` | `#66cbbf` | Underwriting |
| `chart-5` | `#0f766e` | `#8fd3c9` | Conditional approval |
| `chart-6` | `#0b5049` | `#b9e8e1` | Clear to close |
| `banner` | `#fcd34d` | `#fcd34d` | impersonation banner background, both themes |
| `banner-foreground` | `#1c1400` | `#1c1400` | banner text and its outlined button |
| `radius` | `6px` | `6px` | the one radius |

Shadows: card `0 1px 2px rgba(0,0,0,.06)` (dark `.4`); popover, dialog, toast `0 8px 24px rgba(0,0,0,.12)` (dark `.5`).

## Recipes
- **Focus ring** on every interactive element: `box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--ring)`.
- **Semantic pill** (success / warning / destructive): text and icon in the token, background `color-mix(in oklab, var(--<token>) 12%, var(--card))`.
- **Neutral pill** (Requested, Waived, Needed, No longer needed): `muted` background, `muted-foreground` text.
- **Stage pill**: background `color-mix(in oklab, var(--chart-N) 22%, var(--card))`, text `foreground`, stage icon.
- **Active nav item**: `primary` text on `color-mix(in oklab, var(--primary) 10%, var(--card))`.
- **Avatars**: initials on `color-mix(in oklab, var(--primary) 16%, var(--card))`; the login primary card uses solid `primary`.
- **Demo badge**: dashed border, 24 px, 11 px 500, `info` icon, "Demo · synthetic data".

## Type
Display **Geist 600**: wordmark 17 px (sidebar) / 28 px (login), h1 20/28, KPI value 28/32 tabular, borrower greeting 24/30. Body **Inter**: section title 15/22 600, body 14/20 (public page 15/22), control 13/18 500, caption 12/16, tag 11/14 500. `font-variant-numeric: tabular-nums` on every number. Money right-aligned ("$485,000"); dates "Sep 19".

## Sizes and spacing
4 px scale. Sidebar 240 px; top row 56 px. Buttons 32 px, inputs 36 px, pills 22 px, tags 20 px, nav items 36 px, banner 40 px. Table rows 40 px, header 36 px on `muted`. Board cards 12 px padding, column gap 12 px, 2 px bottom border per column in its `chart-N`. Page gutter 24 px desktop, 16 px mobile; header padding 16/24. Public page single column max 640 px, touch targets ≥ 44 px. Dialogs 420 px (confirm) / 560 px (forms); menus 220 px.

## Icons (Lucide only; 16 px in pills, buttons, menus, rows; 20 px in nav and empty states)
Stages: Lead `circle` · Application `file-text` · Processing `loader` · Underwriting `search` · Conditional approval `list-checks` · Clear to close `check` · Funded `circle-check` · Withdrawn `circle-minus` · Denied `circle-x`.
Conditions: Requested/Needed `circle` · Received `clock` · Cleared/Accepted `circle-check` · Waived / No longer needed `circle-minus` · Needs another `circle-alert`. Document review: Pending `clock` · Accepted `circle-check` · Rejected `circle-x`.
Attention tags: Needs review `file-text` · Stalled `flag` · Closing soon `calendar` (destructive tone). Nav: Dashboard `layout-dashboard` · Pipeline `kanban` · Queue `inbox` · Users `users` · Activity `activity`. Roles: Superadmin `shield` · Loan officer `briefcase` · Processor `clipboard-check`. Theme `sun` / `moon` / `monitor`. Impersonation `eye`. Reset `rotate-ccw`. Wordmark mark: stroke path `M2 14h8l3 4 9-12`, stroke 2.5, `primary`.

## Page skeletons
- **Staff shell** (`(staff)/layout.tsx`): sidebar on `card` with right hairline; wordmark row; role nav (Priya: Dashboard · Pipeline · Queue · Users · Activity; Alex: Pipeline · Dashboard; Sam: Queue); persona chip at the bottom (28 px initials avatar, name 13/500, role 12 muted, `chevrons-up-down`) whose menu holds the Light / Dark / System segmented control and "Sign out"; demo badge under it. Content column with h1 left and at most one primary action right (Pipeline "New loan", Loan detail "Submit to underwriting", Users "Create user"; none on Queue, Dashboard, Activity; "Reset demo data" is a destructive-styled secondary). Skip-to-content link is the first tab stop, visible on focus top-left as a primary button.
- **Impersonation banner**: 40 px, full width above everything, `banner` background with `banner-foreground` text in both themes, `role="status"`, "Viewing as Alex Rivera · Loan officer" plus an outlined "Exit view" button (next tab stop after the skip link). While impersonating, the sidebar and chip show the target user; superadmin nav is hidden.
- **Public shell** (`u/[token]`): top bar on `card` with wordmark and "Your loan officer: Alex Rivera · (512) 555-0134" (`phone`, `tel:` link, stacked on mobile); single column; footer "Demo system with synthetic data. Do not upload real personal documents."

## Component rules
- shadcn/ui as the base, restyled through tokens; never fork a component.
- `Pill` for every status (stage, condition, review): icon + text, per the recipes; never colour alone. Attention on a loan card is a tag with icon + text, never a dot.
- `KpiTile`: label 13 muted with an `info` disclosure button, value Geist 28 tabular, unit 13 muted, sub-line 12; the disclosure opens a `muted` box with the definition.
- `EmptyState`: dashed box, 20 px icon, one plain sentence, one line of guidance or one action. Designed per screen (see README), no generic "No data".
- Loading: skeleton blocks matching the layout (charts: grey bars). Errors: plain sentence and a retry.
- `ConfirmDialog` (420 px) for destructive or irreversible actions; forms in 560 px dialogs; Cancel left, primary right.
- Tables for staff lists (amounts right-aligned), cards for the pipeline board and the public page. Hover raises the card border to `muted-foreground`.
- Charts: token-driven CSS bars (stage colours `chart-1..6`; aging buckets `chart-2`, `chart-4`, `warning`, `destructive`); every bar is a keyboard-reachable disclosure button carrying its data point, plus a visually hidden summary sentence. Recharts is deferred (Should).
- Upload zone: idle 72 px min, dashed `primary`, `upload` icon, "Tap to upload" / "PDF, JPG or PNG · up to 10 MB"; drag-over 2 px dashed + 8 % tint, "Drop to upload"; error destructive border "That file is too large".
- Motion: 150 ms ease-out fades, slides ≤ 8 px. Under `prefers-reduced-motion`: no transitions, no skeleton shimmer, static spinner.

## Copy voice
- Staff: precise and compact. "Clear condition", "Reject · reason required", "Move to Processing", "Submit to underwriting".
- Public page: warm and plain. "Hi Maria, here's where your loan stands.", "Alex needs 3 things from you.", "Received, under review", "Needs another: pages are cut off", "Nice, that's everything for now." Never an enum, never "pending" or "rejected".
- Buttons say what happens ("Copy Maria's link", "Create loan", "Clear condition"), never "Submit" or "OK".
- Stage labels only from `src/lib/stages.ts`.

## Dark mode
A token swap only: swap the table above, keep every recipe. The banner keeps `#fcd34d` with dark text in both themes. Check every screen in both themes; axe runs in both.
