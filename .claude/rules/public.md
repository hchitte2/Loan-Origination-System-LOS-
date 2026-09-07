---
paths:
  - "src/app/u/**"
  - "src/app/api/upload/**"
  - "src/server/queries/public.ts"
  - "src/server/actions/public.ts"
---
# Public page rules (`/u/[token]`, the borrower's view)

- There is no session here. Every page, action and route resolves the loan with `requirePublicLoan(token)`: token exists, `upload_token_revoked_at` is null, loan stage is not terminal. Otherwise render the designed "This link is no longer active" page (`not-found.tsx`), never a stack trace or a redirect to login.
- Read through `queries/public.ts` only, which selects the permitted columns (PLAN.md §2 "Public link" column) and returns `PublicLoanView`. Components on this route accept only that type.
- Shows: borrower first name, property, purpose and program, amount, friendly stage label (`borrowerLabel`), target close date, pre-approval facts, the assigned loan officer's name and phone, borrower-facing conditions with status (waived shows as "No longer needed") and plain-language rejection reason, the borrower's own uploads and their status.
- Never shows: internal (`borrower_facing = false`) conditions, staff names beyond the loan officer's name and phone, borrower email/phone of record, document download links, activity, other loans, enum values.
- Uploads: `UploadZone` per condition → Blob client upload with the token in `clientPayload` → `registerPublicDocument` action (re-validates token, prefix, type, size, caps) → status card updates. Store the e-consent checkbox with the first upload in the activity `detail`.
- Copy is warm and plain. Statuses: "Needed", "Received, under review", "Accepted", "Needs another: <reason>". Never "pending" or "rejected".
- Status changes are announced in an `aria-live="polite"` region. Mobile-first: single column, 44 px targets, upload zone usable by tap and keyboard.
- Every render carries the demo notice: "Demo system with synthetic data. Do not upload real personal documents."
- Caps apply here first: per-loan and global daily upload caps from `limits.ts`; a cap reached shows "Demo limit reached, try again tomorrow", not an error.
- `robots: noindex` on this route.
