# Demo LOS: Build Roadmap

A portfolio-grade demo of a loan origination system, built solo with Claude Code.
Goal: a 10-minute walkthrough that shows product thinking, UI craft, and an
AI-native workflow. Not a real LOS; a believable, beautiful slice of one.

Working name: pick one before day 1 and never call it "demo LOS" in the UI.
Candidates: **Clearline**, **Homerun**, **Lendable**, **Keystone**. Rename
everywhere via find-and-replace on `{{APP_NAME}}`.

---

## Ground rules (read every session)

1. **UI is the product.** Every screen gets designed loading, empty, and error
   states. No native browser controls where a styled component exists. If a
   screen looks generic, it is not done.
2. **Everything a user creates is CRUDable.** Create, edit, delete, and undo
   (or a deliberate, stated reason why not).
3. **Own the design language.** All colors, spacing, and type come from the
   tokens in `.claude/skills/design-system.md`. Never inline a random hex.
4. **Small commits, plan first.** Each phase starts with a written plan Claude
   proposes and Hemakshi approves. Commit per finished step, message in
   conventional style (`feat(pipeline): ...`).
5. **Verify in the browser as the real role** before calling anything done.
6. This is original work. No code or distinctive design from any employer's
   codebase.

---

## The product in one paragraph

{{APP_NAME}} moves a mortgage loan from application to closing. A **loan
officer** creates the loan and invites the borrower. The **borrower** completes
a guided application and uploads documents against a needs list. A
**processor** reviews documents, manages conditions, and advances the loan.
Everyone sees the same truth, filtered by role. An AI assistant reads each
uploaded document and suggests what it is and which condition it satisfies;
a human always confirms.

## Personas and demo accounts

| Account | Role | What they demo |
|---|---|---|
| Alex Rivera | Loan officer | Pipeline, create loan, invite borrower |
| Maria Chen | Borrower | Application wizard, uploads, progress |
| Sam Okafor | Processor | Doc review, conditions, stage advance |
| (link only) | Realtor viewer | Read-only status page, v2 if time allows |

Login page shows three "Enter as ..." cards. No passwords typed in a demo, ever.

## Loan lifecycle

`application` → `review` → `conditions` → `approved` → `closed`

- Stage lives on the loan; every change writes an `activity` row.
- Borrower progress tracker derives from stage + application sections +
  open conditions. Never show a raw enum to the borrower; show
  "We're reviewing your documents".

---

## Stack

- React + TypeScript + Vite + Tailwind + shadcn/ui
- Supabase free tier: Auth, Postgres with RLS, Storage, Edge Functions, Realtime
- TanStack Query for all server state; Supabase realtime invalidates queries
- Claude API (one edge function) for the document checker
- Deploy: Vercel Hobby (app) + Supabase hosted project

---

## Data model

Seven tables. Write the migration once, early, with RLS in the same file.

```sql
-- roles live on the profile for demo simplicity
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role text not null check (role in ('loan_officer','processor','borrower')),
  created_at timestamptz not null default now()
);

create table loans (
  id uuid primary key default gen_random_uuid(),
  label text not null,                         -- "Chen · 123 Maple Ave"
  amount numeric(12,2) not null,
  purpose text not null check (purpose in ('purchase','refinance')),
  property_address text not null,
  stage text not null default 'application'
    check (stage in ('application','review','conditions','approved','closed')),
  target_close_date date,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table loan_members (
  loan_id uuid references loans on delete cascade,
  profile_id uuid references profiles on delete cascade,
  member_role text not null
    check (member_role in ('loan_officer','processor','borrower','viewer')),
  primary key (loan_id, profile_id)
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null unique references loans on delete cascade,
  sections jsonb not null default '{}',        -- about_you, employment, assets, declarations
  completed_sections text[] not null default '{}',
  submitted_at timestamptz
);

create table conditions (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans on delete cascade,
  title text not null,                         -- "Two most recent pay stubs"
  description text,
  status text not null default 'open'
    check (status in ('open','submitted','cleared','waived')),
  created_by uuid references profiles(id),
  cleared_by uuid references profiles(id),
  cleared_at timestamptz,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans on delete cascade,
  uploaded_by uuid not null references profiles(id),
  file_name text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  doc_type text,                               -- 'Pay stub', 'W-2', 'Bank statement', ...
  condition_id uuid references conditions(id),
  review_status text not null default 'pending'
    check (review_status in ('pending','accepted','rejected')),
  review_reason text,
  ai_suggestion jsonb,                         -- {doc_type, condition_id, confidence, rationale}
  created_at timestamptz not null default now()
);

create table activity (
  id bigint generated always as identity primary key,
  loan_id uuid not null references loans on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,                        -- 'loan.created', 'document.accepted', ...
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

**RLS (the interview talking point):**
- Staff (loan_officer, processor) read/write loans where they are a
  `loan_member`; for demo scale, LOs also see all loans on the pipeline.
- Borrowers see only loans where they are a member with `member_role='borrower'`,
  and only non-internal fields.
- `activity` is insert-only for everyone; no update or delete policy exists.
  Say the phrase "append-only audit log" in the demo.
- Storage bucket policy mirrors document RLS: a borrower can only read files
  under their own loans' paths.

---

## Screens and acceptance criteria

### 1. Demo login (first impression)
Three persona cards with name, role, one-line description, and an
"Enter as" button (signInWithPassword under the hood with seeded creds).
Wordmark, accent color, dark neutral background. Done when it looks like a
product's marketing page, not a dev tool.

### 2. LO pipeline (the money shot)
Kanban, one column per stage. Loan cards: borrower name, amount, address,
days in stage, avatar stack of members, small attention badge when documents
await review. Drag between stages writes the stage + an activity row.
"New loan" opens a modal: label, amount, purpose, address, borrower email
(creates the borrower account + membership + invite state). Designed empty
state for a stage with no loans.

### 3. Loan detail
Header: label, stage pill, amount, close date. Tabs:
- **Overview**: key facts, member list, next-step hint per stage.
- **Application**: read-only view of what the borrower filled, per section,
  with completion ticks.
- **Documents**: table of uploads with doc type, linked condition, review
  status pill; accept/reject with a required reason on reject.
- **Conditions**: list with status; create, edit, clear, waive; each shows
  linked documents.
- **Activity**: the audit feed, newest first, human-readable sentences.

### 4. Borrower portal
- **Home**: greeting, progress tracker (4-5 friendly steps derived from
  stage), "needed from you" count.
- **Application wizard**: 4 steps (About you, Employment & income, Assets,
  Declarations). Autosaves per field to `applications.sections`. Progress
  persists across sessions. Validation friendly, never shouty.
- **Needs list**: one card per open condition with drag-drop upload zone.
  After upload: "Suggested: Pay stub → 'Two most recent pay stubs'" from the
  AI, borrower can accept the suggestion or pick manually. Status pills:
  Needed → Uploaded → Under review → Accepted / Needs another (with reason).

### 5. Processor queue
Two lists: documents pending review (accept / reject with reason) and open
conditions (clear / waive). Accepting the last document on a condition prompts
"Clear this condition?". Advancing stage available when all conditions clear.

### 6. AI document checker (the differentiator)
Edge function `suggest-document`:
input `document_id` → signed URL from Storage → one Claude API call
(multimodal, structured JSON output) with the file plus the loan's open
condition titles → writes `documents.ai_suggestion` and `doc_type`.
Rules: never auto-link, human confirms; show confidence as words
("Looks like a pay stub"), not decimals; on API failure the upload still
succeeds and the UI just skips the suggestion (graceful degradation, say so
in the demo). `ANTHROPIC_API_KEY` via `supabase secrets set`, never in code.

### 7. Realtime moment
Processor accepts a document or clears a condition → borrower's open tab
updates within a second via a Supabase realtime subscription that invalidates
the relevant queries. Rehearse this with two side-by-side browser windows.

---

## Build phases

Each phase = one or two Claude Code sessions. Start every session by pasting
the phase block below; end it with commits and a browser verification.

**Phase 0 · Identity (day 1).** Pick the name. Use Claude Design to mock the
login, pipeline, and borrower needs list; iterate until one direction wins.
Fill the tokens in `design-system.md` from the winning mock. Init repo with
CLAUDE.md and the two skill files.
*Done when: three approved mockups + tokens locked.*

**Phase 1 · Foundation (days 2-3).** Supabase project, the migration above,
storage bucket + policies, seed script (3 personas + 8 loans across stages,
realistic names/amounts, a few conditions and documents each), auth wiring,
role-based routing shells, demo login page.
*Done when: all three personas can log in and land on an empty-but-styled home.*

**Phase 2 · Pipeline + loan detail (days 4-6).** Screens 2 and 3, minus the
documents tab's review actions.
*Done when: LO can create a loan, invite Maria, move stages, and every tab
renders with real seeded data.*

**Phase 3 · Borrower portal (days 7-9).** Screen 4, uploads to Storage,
autosaving wizard.
*Done when: Maria completes an application and uploads against a condition
end to end.*

**Phase 4 · Processor + review loop (day 10).** Screen 5 plus the documents
tab actions; wire status pills borrower-side.
*Done when: the full loop runs: upload → review → accept → condition clear →
stage advance, with activity rows for each.*

**Phase 5 · AI checker (days 11-12).** Screen 6.
*Done when: a real pay-stub-looking PDF gets a correct suggestion and a
nonsense file degrades gracefully.*

**Phase 6 · Realtime + polish (days 13-14).** Screen 7, then a full
empty/loading/error sweep, borrower-portal mobile pass, favicon + meta,
deploy to Vercel, seed the hosted project.
*Done when: the 10-minute demo script runs clean twice in a row on the
deployed URL.*

---

## Demo script (rehearse this)

1. Login page. "Three roles, one loan. Let me walk one loan through all of
   them." (30s)
2. As Alex: pipeline tour, create the loan, invite Maria. (2 min)
3. As Maria: application wizard (pre-filled by seed except one section she
   fills live), upload a pay stub, the AI suggests the condition, accept. (3 min)
4. As Sam: review queue, accept the document, clear the condition. Split
   screen: Maria's checklist goes green live. (2 min)
5. Advance to approved. Show the activity tab: "every action is on the
   record; this is the audit trail a compliant system needs." (1 min)
6. Flip to the repo: CLAUDE.md, the design skill, commit history, the plan
   docs. "This is how I work with Claude Code: plan, small verified diffs,
   the AI never merges what I can't explain." (2 min)

## Deploy + demo-day checklist

- Vercel Hobby, env vars set, custom subdomain if easy.
- Supabase free projects pause after ~1 week idle: **restore it the day
  before**, run the seed reset, click through all three roles once.
- Have local (`npm run dev`) as backup; the repo README documents both.
- Screen-record one clean run as insurance.
