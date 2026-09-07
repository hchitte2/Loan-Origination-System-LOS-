---
paths:
  - "src/app/**/*.tsx"
  - "src/components/**"
  - "src/app/globals.css"
---
# UI rules

Read `.claude/skills/design-system/SKILL.md` before building or restyling a screen. The pixel target is `design/handoff/reference/<screen>.png` and the screen's section in `design/handoff/README.md`; the HTML under `design/handoff/html/` is a reference build and is never copied.

## Tokens and themes
- Colours, radii, spacing and type come from the tokens in `globals.css` (`:root` light, `.dark` dark, mapped through `@theme inline`). No raw hex, no arbitrary spacing like `mt-[13px]`.
- Every screen must read correctly in both themes. Check both before calling it done; axe runs in both.
- Theme is controlled by `next-themes` (`attribute="class"`, `defaultTheme="system"`). The toggle lives in the persona chip menu. No flash on load; no layout shift between themes.

## Required states
- Every list and detail: `loading.tsx` (skeletons matching the real layout, not spinners), designed empty state (icon, one warm sentence, one action), `error.tsx` (plain message, retry). `not-found.tsx` for missing loans and revoked links.
- Async actions show pending state on the button and announce results in an `aria-live="polite"` region (toast).

## Shared components, not one-offs
- Status: `Pill` (icon + text, never colour-only) for stage, condition status, review status.
- Destructive or irreversible actions: `ConfirmDialog`. Never `window.confirm`.
- Empty: `EmptyState`. Money: `formatMoney` (right-aligned, tabular numerals). Dates: `formatDate` ("Sep 19").
- Forms: shadcn form primitives, zod schema shared with the action, `useActionState`; error text next to the field; labels on every input; no native `select` or date input where a shadcn component exists.
- Tables for staff lists, cards for the public page and the pipeline board.
- Icons: lucide-react only.

## Accessibility floor (WCAG 2.2 AA)
- Skip link first in the DOM. Visible 2 px focus ring on every interactive element. 44 px minimum touch targets on the public page.
- Text contrast 4.5:1, UI contrast 3:1, in both themes.
- One `h1` per page; per-route `<title>` ("Pipeline · Clearline").
- Dialogs trap focus and return it on close. After a stage move or upload, move focus to the updated element or announce it.
- Motion under 200 ms, opacity/transform only, respects `prefers-reduced-motion`.
- Charts: keep Recharts `accessibilityLayer`; add a visually hidden text summary.

## Impersonation banner
Fixed top bar on every staff page while impersonating: amber background with dark text (AA in both themes), `role="status"`, copy "Viewing as Sam Okafor · Processor · Exit view". Exit is a real button and the first tab stop after the skip link. Superadmin nav is hidden while impersonating.

## Copy voice
- Staff (loan officer, processor, superadmin): compact and precise. "Clear condition", "Reject · reason required", "Move to Processing".
- Public page (borrower): warm and plain. "We need your two most recent pay stubs", "Nice, that's everything for now". Never a stage enum, never "pending", never "rejected"; say "Received, under review" and "Needs another: <reason>".
- Buttons say what happens: "Copy Maria's link", not "Submit". Empty states suggest the next action.
- Labels for stages come from `src/lib/stages.ts` (`staffLabel`, `borrowerLabel`). Never inline a label.

## Routing and shell
- Staff routes live under the `(staff)` group with the sidebar shell; the public page under `u/[token]` with the top-nav shell. Home routes: superadmin `/dashboard`, loan officer `/pipeline`, processor `/queue`.
- Every page starts with `requireActor()` (or `requirePublicLoan`) even though the layout also checks.
- "Demo · synthetic data" badge is part of both shells.
