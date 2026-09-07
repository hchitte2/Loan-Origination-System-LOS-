---
name: design-system
description: Clearline's visual system: colour tokens for light and dark, type, spacing, radius, component rules and copy voice per role, taken from the approved Claude Design export. Loaded automatically for any UI work.
user-invocable: false
---

# Design system · Clearline

Status: **tokens pending the design green signal.** The planning chat fills the token tables from the final Claude Design export (`design/reference/*.png` and any CSS in `design/exports/<date>/`). Until then, use shadcn defaults and do not invent a palette. After the fill, this file is law: if a screen needs something the system lacks, extend the system here first (propose it), then use it.

## Tokens

Semantic names below map to CSS variables in `src/app/globals.css` (`:root` for light, `.dark` for dark) and to Tailwind utilities through `@theme inline`. Never use a raw colour in a component.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--background` | TODO | TODO | page background |
| `--foreground` | TODO | TODO | primary text ("ink") |
| `--muted` / `--muted-foreground` | TODO | TODO | panels, secondary text |
| `--card` / `--card-foreground` | TODO | TODO | cards, table surfaces |
| `--border` | TODO | TODO | hairlines |
| `--primary` / `--primary-foreground` | TODO | TODO | the one accent: primary buttons, active nav, links |
| `--success` / `--success-foreground` | TODO | TODO | cleared, accepted, funded |
| `--warning` / `--warning-foreground` | TODO | TODO | received / under review, stalled, impersonation banner |
| `--destructive` / `--destructive-foreground` | TODO | TODO | rejected, denied, delete |
| `--ring` | TODO | TODO | focus ring (2 px, always visible) |
| `--chart-1 … --chart-6` | TODO | TODO | one colour per active stage, in order |
| `--radius` | TODO | same | one radius everywhere |

Type: display TODO · body TODO (Inter or system stack expected) · tabular numerals (`font-variant-numeric: tabular-nums`) for money and counts.
Spacing: Tailwind's 4 px scale; page gutter TODO; card padding TODO; table row height TODO.

## Page skeletons
- **Staff shell**: left sidebar (wordmark, nav, persona chip with theme toggle at the bottom), content column with a page header (h1 left, one primary action right), "Demo · synthetic data" badge in the sidebar footer. Impersonation banner above everything when active.
- **Public shell**: top bar (wordmark, loan officer contact), single column, mobile-first, generous whitespace, demo notice in the footer.

## Component rules
- shadcn/ui as the base; restyle through tokens, never fork a component.
- `Pill` for every status (stage, condition, review): icon + text, semantic colour, never colour alone.
- `KpiTile`: label, value in tabular numerals, delta, a focusable definition disclosure.
- `EmptyState`: icon, one warm sentence, one action. Designed per screen, no generic "No data".
- Loading: skeletons that match the real layout. Errors: plain sentence and a retry.
- `ConfirmDialog` for destructive or irreversible actions. Modals for create/edit forms.
- Tables for staff lists (amounts right-aligned), cards for the pipeline board and the public page.
- Charts: shadcn `ChartContainer` + Recharts 3, stage colours from `--chart-*`, `accessibilityLayer` on, visually hidden summary sentence.

## Copy voice
- Staff: precise and compact. "Clear condition", "Reject · reason required", "Move to Processing".
- Public page: warm and plain. "We need your two most recent pay stubs", "Received, under review", "Needs another: pages are cut off", "Nice, that's everything for now."
- Buttons say what happens ("Copy Maria's link"), never "Submit" or "OK".
- Stage labels only from `src/lib/stages.ts`.

## Dark mode notes
Dark is a token swap, not a second design: dark neutral background (not pure black), panels one step lighter than the page, accent slightly desaturated, semantic colours re-tuned for 4.5:1 on dark surfaces, the amber banner keeps dark text. Check every screen in both themes; axe runs in both.
