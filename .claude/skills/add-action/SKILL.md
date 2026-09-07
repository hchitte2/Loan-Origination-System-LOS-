---
name: add-action
description: Procedure for adding or changing one server action end to end (permission row, zod schema, action, service, activity row, tests, authz review). Use whenever you add or change a Server Action or a mutating route handler.
---

Every mutation in Clearline follows the same eight steps. Do them in order; do not skip the last two.

1. **Permission row.** Find the action's row in PLAN.md §2. If none exists, stop and propose the row (role by role: `W`, `W (own)`, `R`, `–`) in your message; the planning chat adds it. Then add the `POLICY` entry in `src/server/authz.ts` (`"any" | "own" | false` per role) and the `Action` union member.
2. **Schema.** One zod schema in the action file, exported so the form uses the same one. Ids are `z.string().uuid()`. Reasons that are required by an invariant are `z.string().trim().min(3)`.
3. **Action.** In `src/server/actions/<aggregate>.ts`, `"use server"`, in this order: parse → `requireActor()` (or `requirePublicLoan(token)`) → load the loan through `loanScope` (404 if not visible) → `assertCan(actor, action, loan)` → `db.transaction` with the write and `logActivity` → `revalidatePath` for the affected routes → return `{ ok: true }` or `{ ok: false, error }`.
4. **Domain rule.** If the change touches stage or condition status, call `transitions.ts` or the conditions service; never set those columns directly. New invariants go into `transitions.ts` or the service, not the action.
5. **Activity.** Add the action name to the list in PLAN.md §6 if it is new (propose it), use a dot-namespaced name (`condition.waived`), put only what the Activity tab needs in `detail`, and add the human sentence to the activity formatter.
6. **UI wiring.** The form uses `useActionState` with the shared schema; pending state on the button; success announced via toast; errors next to the field. Destructive actions go through `ConfirmDialog`.
7. **Tests.** One row per affected role in `tests/unit/authz.test.ts` (driven from `POLICY`); transition or service rule cases in the matching unit test; if the action is on a demo journey, extend the Playwright spec.
8. **Review.** Run the `authz-reviewer` agent on the files you touched and fix its blockers before calling the work done.

Checklist to paste into your summary: matrix row · POLICY entry · schema · action order · transaction + activity · revalidatePath · UI states · unit test rows · authz-reviewer PASS.
