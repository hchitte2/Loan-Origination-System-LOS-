---
paths:
  - "src/server/**"
  - "src/app/api/**"
  - "src/proxy.ts"
---
# Server rules (actions, queries, route handlers)

## The shape of every mutation
```ts
"use server";
export async function clearCondition(input: unknown) {
  const data = ClearConditionSchema.parse(input);          // 1. zod first, never trust the client
  const actor = await requireActor();                      // 2. who is acting (effective user + real human)
  const loan = await getLoanForActor(actor, data.loanId);  // 3. load through loanScope(actor); 404 if not visible
  assertCan(actor, "condition.clear", loan);               // 4. matrix row from authz.ts; throws Forbidden
  await db().transaction(async (tx) => {                   // 5. write + activity row atomically (db() is the lazy client)
    await conditionsService.clear(tx, loan, data);
    await logActivity(tx, { loanId: loan.id, actor, action: "condition.cleared", detail: { conditionId: data.conditionId } });
  });
  revalidatePath(`/loans/${loan.id}`);                      // 6. precise revalidation
  return { ok: true };
}
```
- Expected failures (validation, gate not met, cap reached) return `{ ok: false, error }` with a user-readable message. Bugs throw.
- `db()` and `getEnv()` are functions, called inside the action or query at use time. Never create a module-level client or read `process.env` at import; `next build` and unit tests import these modules without secrets.
- Client-supplied ids are looked up, then scoped; never used to build a query without `loanScope(actor)`.
- No business logic in `src/app`. Pages call queries; forms call actions.

## Actors and impersonation
- `requireActor()` returns `{ userId, role, actorUserId, impersonating }`. Authorize with `userId`/`role` (the effective user). Log with `actor_id = actorUserId` and `on_behalf_of = impersonating ? userId : null`.
- Impersonation start/stop live in `actions/admin.ts`, call the Better Auth admin API with request `headers`, and write `admin.impersonation_started/ended` rows. Superadmin-only.
- Public routes use `requirePublicLoan(token)`: token exists, not revoked, loan not terminal. No session assumptions.

## Authorization table
- `authz.ts` holds `POLICY: Record<Role, Record<Action, "any" | "own" | false>>`, transcribed from PLAN.md §2. `can(actor, action, loan?)` resolves `"own"` as `loan.loan_officer_id === actor.userId`.
- Adding an action means adding a matrix row in PLAN.md (propose it), a POLICY entry, and a row in `authz.test.ts`. The table is the test fixture.
- `redactForPublic(loan, conditions, documents)` returns `PublicLoanView`. Public components accept only that type.

## Reads
- Queries take an `actor` (or a public token) and apply `loanScope` themselves. No query returns rows outside the caller's scope.
- Public queries live in `queries/public.ts` and select only the permitted columns.
- Analytics queries take `loanScope(actor)` and return numbers; formulas live in `lib/analytics-math.ts`.

## Stage moves
- Only `transitions.ts` decides. `move(loan, to, actor, reason?)` returns `{ ok } | { ok: false, error }`. Actions never assign `loans.stage`.

## Uploads and files
- `/api/upload` uses `handleUpload`; `onBeforeGenerateToken` authenticates (session or public token in `clientPayload`), enforces `allowedContentTypes` (pdf, jpeg, png), `maximumSizeInBytes` (10 MB), the caps in `limits.ts`, and the `uploads/<loanId>/` pathname prefix.
- `registerDocument` (staff session, `actions/documents.ts`) and `registerPublicDocument` (loan token, `actions/public.ts`) re-check everything, reject any pathname outside the loan's prefix, and never trust `onUploadCompleted`.
- `/api/files/[documentId]` authorizes, then streams the private blob with `Cache-Control: private, no-store`.
- Storage calls go through `server/storage.ts` only.

## Limits and safety
- All caps are constants in `limits.ts`, checked server-side by counting existing rows. No counters table.
- Cron routes check `Authorization: Bearer ${CRON_SECRET}` before anything else and return 401 otherwise.
- Never log secrets, tokens or file contents. Never build SQL from strings except in migrations and the analytics aggregates, and then with parameters.
