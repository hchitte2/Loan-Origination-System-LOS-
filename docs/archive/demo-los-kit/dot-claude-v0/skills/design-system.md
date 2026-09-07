# Design system · {{APP_NAME}}

Fill the TODO tokens in Phase 0 from the winning Claude Design mockups, then
treat this file as law. If a screen needs something the system lacks, extend
the system here first, then use it.

## Tokens

- Ink (primary text): TODO
- Muted text: TODO
- Surface / page background: TODO
- Panel background: TODO
- Hairline border: TODO
- Accent (one, used sparingly): TODO
- Semantic: success TODO · warning TODO · danger TODO
- Radius: TODO (pick one, use everywhere)
- Font: display TODO · body TODO · mono (labels, amounts) TODO

Dark mode: skip unless Phase 6 has spare time; a committed single theme done
well beats a rushed toggle.

## Page skeleton

Sidebar (wordmark, nav, persona chip at bottom) + content column with a page
header (title, primary action right-aligned). Borrower portal uses a
simpler top-nav layout, friendlier, more whitespace, mobile-first.

## Component rules

- shadcn/ui as the base; restyle via tokens, don't fork components.
- Status pills everywhere state appears: stage on loans, review status on
  documents, condition status. One shared Pill component, semantic colors.
- Tables for staff, cards for borrowers.
- Modals for create/edit; confirm dialogs for destructive actions (shared
  ConfirmDialog, never window.confirm).
- Empty states: an icon, one warm sentence, one action button. Design each,
  no generic "No data".
- Loading: skeletons matching the real layout, not spinners, on primary
  surfaces.
- Amounts right-aligned, tabular numerals. Dates as "Mar 4" style.

## Copy voice

- Staff surfaces: precise and compact. "Clear condition", "Reject · reason
  required".
- Borrower surfaces: warm and plain. "We need two recent pay stubs",
  "Nice work, that's everything for this step."
- Buttons say what happens: "Invite Maria", not "Submit".
