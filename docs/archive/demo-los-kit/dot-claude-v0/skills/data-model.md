# Data model · {{APP_NAME}}

The schema truth. The full SQL lives in ROADMAP.md and, once applied, in
`supabase/migrations/`. Regenerate types after any schema change and never
guess a column name; read the generated types.

## Tables (7)

- `profiles`: identity + one role (`loan_officer` | `processor` | `borrower`).
- `loans`: the record; `stage` is the lifecycle
  (`application` → `review` → `conditions` → `approved` → `closed`).
- `loan_members`: who is on a loan and as what (`member_role`); all access
  derives from this.
- `applications`: one per loan; wizard sections as jsonb
  (`about_you`, `employment`, `assets`, `declarations`) +
  `completed_sections`.
- `conditions`: needs-list items; `open` → `submitted` → `cleared` | `waived`.
- `documents`: uploads; `doc_type`, optional `condition_id`,
  `review_status` (`pending` | `accepted` | `rejected`) + `review_reason`,
  `ai_suggestion` jsonb.
- `activity`: append-only audit log; `action` strings are dot-namespaced
  (`loan.created`, `document.accepted`, `condition.cleared`).

## Invariants

- Every meaningful mutation also inserts an `activity` row, in the same
  client mutation (demo scope; a trigger is a stretch goal to mention).
- A document with `review_status='rejected'` requires `review_reason`.
- Clearing a condition requires at least one accepted linked document, or an
  explicit waive.
- Stage can only advance to `approved` when no conditions are `open` or
  `submitted`.
- Borrower-visible reads never include other members' personal data.

## RLS intent

- Staff: access via `loan_members` membership; LOs additionally list all
  loans for the pipeline (demo simplification, stated in the demo).
- Borrowers: rows only for loans where they hold `member_role='borrower'`.
- Storage: object paths are `loans/{loan_id}/...`; policies check membership
  on the path's loan.
- `activity`: insert-only; no update/delete policies exist at all.

## Query conventions

- TanStack Query keys: `['loans']`, `['loan', id]`, `['loan', id, 'documents']`,
  `['loan', id, 'conditions']`, `['loan', id, 'activity']`.
- Realtime: one channel per open loan; on any change to that loan's
  documents/conditions/loans row, invalidate the matching keys.
- Mutations invalidate precisely, not `queryClient.clear()`.
