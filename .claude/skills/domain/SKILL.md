---
name: domain
description: US mortgage vocabulary and the reasons behind Clearline's rules (stages, conditions and prior-to buckets, what the borrower page may show, KPI definitions, compliance touches). Loaded automatically when working on loans, conditions, documents, analytics or user-facing copy.
user-invocable: false
---

# Domain notes · Clearline

The permission matrix lives in PLAN.md §2, enums and invariants in PLAN.md §6, KPI formulas in PLAN.md §7, labels in `src/lib/stages.ts`. This file explains *why*, so copy and behaviour stay believable to mortgage people.

## What kind of product this is
A **LOS** (loan origination system: Encompass, Arive, LendingPad) is the system of record for the loan file. A **mortgage CRM** (Jungo, Surefire, Total Expert) tracks leads, referral partners and production. A **POS** (Floify, Blend) is the borrower-facing application and document portal. Clearline owns the overlap: pipeline + people + progress. It deliberately does not do pricing, disclosures, automated underwriting, closing documents or funding.

## Lifecycle (one `stage` enum)
| Stage | Staff label | Borrower label | Who advances | Meaning |
|---|---|---|---|---|
| `lead` | Lead | Getting started | loan officer | Contact created; pre-approval happens here (a lead attribute, not a stage) |
| `application` | Application | Application received | loan officer | Borrower applied. In real life the TRID clock starts (Loan Estimate within 3 business days) |
| `processing` | Processing | Gathering your documents | loan officer → processor | Needs list issued, documents collected |
| `underwriting` | Underwriting | In underwriting review | processor | File submitted to underwriting |
| `conditional_approval` | Conditional approval | Conditionally approved | processor (as underwriter proxy) | Approved subject to conditions |
| `clear_to_close` | Clear to close | Clear to close | processor | All prior-to-docs conditions cleared |
| `funded` | Funded | Closed and funded | processor (as closer proxy) | Money disbursed; terminal |
| `withdrawn` | Withdrawn | Application withdrawn | loan officer | Borrower withdrew; terminal; needs `closed_reason` |
| `denied` | Denied | Not approved | processor | Credit decision was no; terminal; needs `closed_reason`. In real life an adverse-action notice is due within 30 days (Reg B) |

Backward moves (one step) model resubmittal; there is no separate stage for it. "Closing" is merged into clear to close → funded.

## Conditions and documents
- Underwriters group conditions by when they must be satisfied: **prior to approval / prior to docs (PTD)** items must be cleared before closing documents are drawn; **prior to funding (PTF)** items (homeowners insurance binder, verbal employment check) are cleared just before the wire. This is why `prior_to` exists and why clear to close ignores `funding` items.
- Status vocabulary is simplified from Encompass: `requested → received → cleared`, side exit `waived`. "Rejected" is modelled as received → requested with a reason, which the borrower sees as "Needs another: …".
- `borrower_facing = false` conditions ("Appraisal received", "Title commitment") never appear on the public page. Real systems call this "print externally".
- Document types in `src/lib/doc-types.ts` follow standard checklists: pay stubs (30 days), W-2s (2 years), bank statements (2 months, all pages), photo ID, purchase contract, insurance binder, tax returns, gift letter, letter of explanation.

## The borrower page: what it may show and why
Borrower financial data is nonpublic personal information under GLBA. The public page therefore shows the borrower's own loan facts (amount, property, program, stage, dates, pre-approval, their own uploads and reasons) but no internal conditions, no staff notes, no activity, and no file downloads. Realtors, if ever added, would see even less: milestones, dates and counts, never condition text, documents or denial reasons.

## Roles folded for the demo
Underwriter and closer are real jobs; the processor presses their buttons here with a tooltip saying so. Loan officers are licensed (NMLS id, fake in seed); processors are not.

## KPI definitions (formulas in PLAN.md §7)
- **Pull-through**: funded ÷ applications started in a cohort window, because loans take 1.5–2 months; industry ~70–78%.
- **Cycle time**: application date → funded date; ICE reported ~37 days for purchases in early 2026.
- **Turn time**: days spent in one stage, from `loan.stage_changed` rows.
- **Stalled**: past a per-stage threshold (processing 10 d, underwriting 5 d, conditional approval 7 d, clear to close 5 d).
- **Closing soon / at risk**: target close within 14 days and not yet clear to close; the Closing Disclosure must be received 3 business days before signing, which is why 5 business days matters.

## Compliance touches (mention, do not implement)
Append-only audit trail including impersonation (GLBA Safeguards) · adverse action within 30 days (ECOA / Reg B) · Loan Estimate and Closing Disclosure timing (TRID) · no referral fees to partners (RESPA §8) · e-consent checkbox on the public page (ESIGN) · `closed_reason` mirrors HMDA action-taken codes · no protected-class fields anywhere (fair lending). All data is synthetic; say so on every page.

## Glossary (short)
Needs list = borrower-facing open conditions · PTD/PTF = prior to docs / prior to funding · CTC = clear to close · VOE = verification of employment · LOE = letter of explanation · LTV = loan amount ÷ price (derivable) · NPI = nonpublic personal information · pre-approval = reviewed credit/income/assets, letter with amount and expiry.
