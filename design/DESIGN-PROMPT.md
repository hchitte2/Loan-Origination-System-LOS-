# Clearline — design brief for Claude Design

Paste everything below the line into Claude Design as the opening prompt. Iterate there. When the frames match this brief, export, unzip into `design/exports/<yyyy-mm-dd>/`, copy the final PNGs to `design/reference/`, and write "green signal" in the planning chat.

---

## What to design

Design the product UI for **Clearline**, a demo loan origination system for a small US mortgage shop. Produce **8 artboards** (about 16 frames in total, listed below) as one coherent system that a developer will rebuild with shadcn/ui, Tailwind and Lucide icons. Start with artboard 8 (the component sheet) and artboard 2 (the pipeline) so the system is settled before the other screens.

- Staff screens at **1440 × 900** desktop. The borrower's public page at **390 × 844** mobile and at 1440.
- **Light theme for every frame.** Add **dark-theme variants** of the Login, the Pipeline board and the Public upload page, and produce the component sheet in **both** themes.
- Use only the sample data at the end of this brief so every screen tells the same story. Treat today as **Sep 6, 2026**; all ages are relative to it.

## The product in one paragraph

Clearline moves a mortgage loan from lead to funded. A **loan officer** creates the loan and moves it through the early stages. A **processor** collects documents against a needs list, reviews them, clears conditions and advances the file to funded. The **borrower** never logs in: they open a private link on their phone, see what is needed, and upload documents. A **superadmin** (the broker-owner) sees every loan, every metric and every user, and can "view as" any user to see exactly what they see. Every action is written to an audit log that cannot be edited. Visitors to the demo enter as the superadmin and explore from there.

## Feeling and references

Calm, precise, trustworthy operations software. Think Linear, Mercury, Stripe Dashboard: neutral surfaces, one accent used sparingly, clear hierarchy, dense but readable tables, generous whitespace on the borrower page. Not a bank's marketing site, not a dashboard template with gradients. A mortgage processor should feel at home; a first-time visitor should understand each screen without a tour. The wordmark is the word "Clearline" in the display face with a small simple mark (a horizontal line breaking into a checkmark works); no illustration anywhere.

## Personas and their voice

| Persona | Role | Lands on | Sidebar navigation | Voice on their screens |
|---|---|---|---|---|
| Priya Nair | Superadmin, broker-owner | Dashboard | Dashboard · Pipeline · Queue · Users · Activity | Neutral operator: "View as Alex Rivera", "Activity log", "Reset demo data" |
| Alex Rivera | Loan officer (NMLS 1234567) | Pipeline board | Pipeline · Dashboard | Compact, commercial: "Move to Processing", "Copy Maria's link" |
| Sam Okafor | Processor | Review queue | Queue only (Sam opens loans from queue rows) | Precise checklist: "Accept", "Reject · reason required", "Clear condition" |
| Maria Chen | Borrower, no account | Public upload page | none (top bar only) | Warm and plain: "We need your two most recent pay stubs", "Nice, that's everything for now" |

Buttons say what happens ("Copy Maria's link", "Clear condition"), never "Submit" or "OK".

## Vocabulary (use exactly)

**Loan stages, in order.** Six active: Lead · Application · Processing · Underwriting · Conditional approval · Clear to close. Three terminal: Funded · Withdrawn · Denied.
On the borrower page the same stages read: Getting started · Application received · Gathering your documents · In underwriting review · Conditionally approved · Clear to close · Closed and funded · Application withdrawn · Not approved.

**Condition (needs-list item) statuses, staff.** Requested · Received · Cleared · Waived. Each condition also carries a small "prior to" tag: before approval · before docs · before funding.
**The same statuses on the borrower page.** Needed · Received, under review · Accepted · No longer needed (waived; no upload zone, same quiet treatment as Accepted) · Needs another: <reason> (a Needed item whose last upload was rejected).

**Document review statuses (staff).** Pending · Accepted · Rejected (reason shown).

**Loan programs.** Conventional · FHA · VA. **Purpose.** Purchase · Refinance.

## Layout rules

- **Staff shell**: left sidebar 240 px with the wordmark at top, the role's navigation (table above), and at the bottom a persona chip (avatar, name, role) whose menu holds the theme toggle (Light / Dark / System) and "Sign out". Content column with a page header: h1 left, at most one primary action right (Pipeline: "New loan" · Loan detail: "Submit to underwriting" · Users: "Create user" · Queue, Dashboard and Activity: none; "Reset demo data" is a secondary, destructive-styled button, never the accent). A small "Demo · synthetic data" badge in the sidebar footer.
- **Impersonation banner**: when the superadmin is viewing as someone, a full-width bar sits above everything: amber background, dark text, "Viewing as Alex Rivera · Loan officer" and an "Exit view" button. While viewing as someone, the sidebar and the persona chip are that person's (nav "Pipeline · Dashboard", chip "Alex Rivera · Loan officer"); only the amber banner reveals the impersonation.
- **Public shell** (borrower page): top bar with the wordmark and "Your loan officer: Alex Rivera · (512) 555-0134", single column, mobile-first, roomy, footer notice "Demo system with synthetic data. Do not upload real personal documents."
- Tables for staff lists; cards for the pipeline board and the borrower page. Money right-aligned with tabular numerals ("$485,000"). Dates as "Sep 19". Density: 40 px table rows, 12 px card padding on the board, 24 px page gutters on desktop, 16 px on mobile.

## Visual system

- **One accent colour** (your choice; a confident blue or deep teal), neutral greys for surfaces, hairline borders, and three semantic colours: success (cleared, accepted, funded), warning (under review, stalled, the amber banner), destructive (rejected, denied, delete).
- **Status pills** always pair an icon with text; colour is never the only signal. Attention on a loan card is a tiny tag with icon and text ("Needs review", "Stalled"), never a bare dot.
- **Icons**: Lucide only. 16 px inside pills, buttons, menus and table rows; 20 px in the sidebar nav.
- **Type**: Inter (or an equivalent system stack), a clear scale (page title, section title, body, caption), tabular numerals for numbers.
- **One radius** used everywhere. A 4 px spacing scale.
- **Dark mode is a token swap, not a second design**: dark neutral background (not pure black), panels one step lighter, accent slightly desaturated, semantic colours re-tuned so text stays at 4.5:1, the amber banner keeps dark text.
- **Deliver a token list** (`tokens.md`) with names and values for light and dark, using exactly these names so the code can copy them 1:1: `background`, `foreground`, `muted`, `muted-foreground`, `card`, `card-foreground`, `border`, `primary`, `primary-foreground`, `success`, `success-foreground`, `warning`, `warning-foreground`, `destructive`, `destructive-foreground`, `ring` (focus), `chart-1` … `chart-6` (one per active stage, in order), `radius`; plus the display and body font families, the type scale, and the three spacing values above.

## Accessibility floor (design it in, do not leave it to code)

WCAG 2.2 AA: 4.5:1 text contrast and 3:1 UI contrast in both themes · a visible 2 px focus ring on every interactive element (show it on the component sheet) · 44 px minimum touch targets on the mobile page · a label on every form field, error text directly under the field · status conveyed by icon + text · motion limited to short fades and slides with a reduced-motion note · a "Skip to content" link position noted on the shell.

## Artboards

**1. Login (light and dark).** Wordmark and one-line tagline ("A demo loan origination system"). A primary card "Enter as Priya Nair · Superadmin · sees everything, can view as anyone". Two secondary cards "Enter as Alex Rivera · Loan officer" and "Enter as Sam Okafor · Processor". A distinct button "Try the borrower experience" that opens Maria's upload link. Under the cards, a three-line suggested tour: "1. Enter as Priya. 2. Open Users and view as Alex or Sam. 3. Open the borrower link on your phone and upload a file." Synthetic-data badge. This must look like a product's front door, not a developer login.

**2. Pipeline board (light and dark), staff shell, Alex signed in, filter set to All.** Six columns, Lead → Clear to close, each header showing count and total dollars exactly as in the sample data. Loan cards: borrower name, city, amount, program pill, days in stage, the loan officer's small avatar, and an attention tag when relevant ("Needs review" when documents await review, "Stalled" when over the threshold). **Underwriting is the empty column** (header "0 · $0") with a designed empty state: "No loans in Underwriting. Files move here when a processor submits them." Header controls: "Mine / All" filter, "Board / List" toggle, primary action "New loan". Show the "Move to…" menu open on **Chen's card** (a Processing loan owned by Alex); its options are "Move back to Application" and "Withdraw…" (a loan officer cannot move a file into Underwriting; that is the processor's step, so no such option appears). Two smaller frames on this artboard: the **List view** of the same data with a "Closed" section showing two Funded rows (Rivera · $410,000 · funded Aug 28; Sandoval · $352,000 · funded Sep 2), and the **New loan** form as a dialog (Borrower name, Email, Phone, Property address, Purpose, Program, Loan amount, Referral source, Target close date; primary "Create loan") with one validation error shown under Email.

**3. Loan detail, staff shell, Sam signed in.** Header: "Chen · 412 Maple Ave" with stage pill "Processing", $485,000, Conventional purchase, target close Oct 3, loan officer Alex Rivera, processor Sam Okafor, and the single primary action "Submit to underwriting". Tabs: Overview · Needs list · Activity. Show the **Needs list** tab as the main frame: conditions as rows with title, status pill, prior-to tag, and age; **the W-2s row expanded** to show its document (w2-2025.pdf · uploaded via Maria's link · 2 d ago · Pending) with inline "Accept" and "Reject" buttons and the reject-reason field open. A small "Clear this condition?" confirmation dialog (button "Clear condition"). Two secondary frames: the **Activity** tab (newest first, plain sentences: "Priya Nair (viewing as Sam Okafor) rejected Pay stubs: pages are cut off · 2 min ago", "Alex Rivera moved the loan from Application to Processing · Yesterday", "Maria Chen uploaded w2-2025.pdf · 2 d ago") and a compact **Overview** tab (facts, people, dates, and a "Borrower link" section with "Copy Maria's link" and "Regenerate link").

**4. Processor queue, staff shell, Sam signed in.** Three KPI tiles: "Documents awaiting review 5 · oldest 2 d", "Open conditions 23", "Active files 8". A "Conditions aging" bar chart with buckets 0–3 d: 9 · 4–7 d: 7 · 8–14 d: 5 · 15+ d: 2. Then the review list: the five pending documents from the sample data, oldest first, columns file · condition · loan · uploaded · age · "Open". Include the empty state of the list as a small frame ("Nothing to review. Enjoy the quiet.").

**5. Public upload page (Maria's phone at 390, plus 1440; light and dark for the phone).** Greeting "Hi Maria, here's where your loan stands." Under it one muted line: "412 Maple Ave, Austin TX · $485,000 · Conventional purchase · Target close Oct 3". A milestone tracker of the six borrower labels with "Gathering your documents" current. A summary line "Alex needs 3 things from you." Needs-list cards, each with title, plain instructions ("Your two most recent pay stubs, all pages"), a tap-to-upload zone, and status, using Maria's needs list from the sample data so these states all appear: **Needed** (zone idle), **Uploading** (progress, on Bank statements), **Received, under review**, **Needs another: pages are cut off** (zone open again), **Accepted**. An e-consent checkbox with short copy ("I agree to receive loan updates electronically") shown once above the first upload. Demo notice in the footer. Two small frames: the **all-done** state ("Nice, that's everything for now. We'll let you know if we need anything else.") and the **expired link** page ("This link is no longer active. Ask your loan officer for a new one.").

**6. Dashboard, staff shell, Priya signed in.** Four KPI tiles: "Active pipeline $6.2M · 13 loans", "Funded this month $1.9M · 4 loans · ▲ from 2 last month", "Pull-through 73% · industry ~70–78%", "Avg cycle time 38 days · ICE avg ~37". Two charts: "Pipeline by stage" (bar, one colour per stage, the six counts from the sample data) and "Conditions aging" (the four buckets above). One table "Needs attention" with the three rows from the sample data (loan, stage, days in stage, target close, reason chip). Show one KPI tile with its definition disclosure open ("Funded loans ÷ applications started 60–180 days ago"). Show one chart in its loading skeleton and one in its empty state as small side frames. A smaller frame: the **loan officer variant** for Alex ("My active pipeline $3.02M · 6 loans", "My funded this month $0.9M · 2 loans", "Closing in 14 days 1"), "My pipeline by stage", and "Needs attention" with Alex's two rows (Brooks, Kim).

**7. Superadmin: Users and Activity, staff shell, Priya signed in.** **Users** table: name, role pill, email, loans assigned, last active, and a "View as" button per row (none on Priya's own row); a "Create user" primary action with its dialog open (Name, Email, Role). A frame of the **Pipeline board with the impersonation banner active** ("Viewing as Alex Rivera · Loan officer · Exit view", Alex's sidebar and chip). The **Activity** page: a filter by action type (All · Stage changes · Documents · Conditions · Users · Impersonation · Resets), a list of events with actor, action sentence, loan, time, including "Priya Nair started viewing as Sam Okafor" and "Priya Nair stopped viewing as Sam Okafor". Include the "Reset demo data" button and its confirmation dialog ("This restores the sample data and removes uploaded files. Visitors' changes from today are lost.").

**8. Component sheet (light and dark).** Token swatches with names and values · type scale · buttons (primary, secondary, ghost, destructive; default, hover, focus ring, disabled, pending) · status pills for every stage, condition and review status in both vocabularies · prior-to tags (three values) · form field (label, input, help text, error state), select, date picker, checkbox, textarea · card · table row (default, hover, selected) · tabs · dropdown menu · sidebar nav item (default, active) · tooltip · KPI tile (with the definition disclosure) · empty state · skeleton block · confirm dialog · toast · impersonation banner · demo badge · theme toggle · upload zone (idle, drag-over, uploading, error) · milestone tracker · a "reduced motion" note.

## What not to design

Marketing pages, settings screens, email templates, a borrower login or application form, a realtor portal, charts beyond the two named, anything involving credit scores, income figures or Social Security numbers.

## Sample data (use consistently; today is Sep 6, 2026)

**Active loans (13). Column headers must read exactly:** Lead 3 · $1,146,000 — Application 2 · $947,900 — Processing 3 · $1,319,000 — Underwriting 0 · $0 — Conditional approval 3 · $1,712,500 — Clear to close 2 · $1,075,000. Total 13 · $6,200,400 (the dashboard's "$6.2M · 13 loans"). Active files for the processor = loans in Processing or later = 8.

- Fischer · 3 Quarry Rd, Boise ID · $274,000 · FHA purchase · Lead · 4 d · LO Morgan Ellis
- Dubois · 14 Cedar Row, Tucson AZ · $312,000 · FHA purchase · Lead · 2 d · LO Jordan Lee
- Haddad · 71 Elm St, Columbus OH · $560,000 · Conventional purchase · Lead · 1 d · LO Alex Rivera
- Alvarez · 640 Sunset Blvd, Phoenix AZ · $529,900 · Conventional purchase · Application · 1 d · LO Alex Rivera
- Larsen · 22 Pinecrest Dr, Minneapolis MN · $418,000 · VA purchase · Application · 3 d · LO Jordan Lee
- Chen · 412 Maple Ave, Austin TX · $485,000 · Conventional purchase · Processing · 6 d · LO Alex Rivera · processor Sam Okafor · target close Oct 3 · tag "Needs review"
- Brooks · 155 Lakeshore Ave, Madison WI · $445,000 · Conventional purchase · Processing · 12 d · LO Alex Rivera · tag "Stalled"
- Kim · 9 Orchard St, Raleigh NC · $389,000 · Conventional purchase · Processing · 3 d · LO Alex Rivera · target close Sep 15 · tag "Needs review"
- Okonkwo · 1901 Birch Ct, Denver CO · $398,000 · VA purchase · Conditional approval · 9 d · LO Jordan Lee · tag "Stalled"
- Patel · 88 Harbor View Dr, Tampa FL · $612,500 · FHA purchase · Conditional approval · 3 d · LO Alex Rivera
- Moreau · 5 Vineyard Ct, Sacramento CA · $702,000 · Conventional purchase · Conditional approval · 2 d · LO Morgan Ellis
- Nguyen · 27 Willow Ln, Portland OR · $355,000 · Conventional refinance · Clear to close · 2 d · LO Jordan Lee · target close Sep 19
- Sato · 300 Bayfront Way, San Diego CA · $720,000 · Conventional purchase · Clear to close · 1 d · LO Morgan Ellis · target close Sep 12

Alex owns 6 active loans totalling $3,021,400 (his "Mine" filter and his dashboard variant).

**Maria Chen's needs list** (loan Chen · 412 Maple Ave): Government photo ID (Accepted) · Pay stubs, last 30 days (Needs another: pages are cut off) · W-2s, last 2 years (Received, under review) · Bank statements, last 2 months (Needed; show this one Uploading) · Purchase contract (Accepted) · Homeowners insurance binder (Needed · before funding). "Alex needs 3 things from you" = Pay stubs, Bank statements, Insurance binder.

**Pending documents (processor queue, oldest first):** w2-2025.pdf · W-2s, last 2 years · Chen · via Maria's link · 2 d — bank-stmt-jul.pdf · Bank statements, last 2 months · Kim · uploaded by Sam Okafor · 1 d — contract-signed.pdf · Purchase contract · Brooks · via link · 1 d — paystubs-aug.pdf · Pay stubs, last 30 days · Kim · via link · 6 h — photo-id.jpg · Government photo ID · Okonkwo · via link · 1 h.

**Needs attention rows (dashboard):** Brooks · Processing · 12 d · target close — · "Stalled 12 d in Processing" — Okonkwo · Conditional approval · 9 d · target close — · "Stalled 9 d in Conditional approval" — Kim · Processing · 3 d · Sep 15 · "Closing in 9 d, not yet clear to close".

**Staff:** Priya Nair (Superadmin), Alex Rivera (Loan officer, NMLS 1234567, (512) 555-0134), Jordan Lee (Loan officer), Morgan Ellis (Loan officer), Sam Okafor (Processor), Riley Brooks (Processor). All emails end in @example.com.

## Deliverables

All frames as PNG at 2×, plus HTML/CSS if the export offers it, plus `tokens.md`. Name files `01-login-light.png`, `01-login-dark.png`, `02-pipeline-light.png`, `02-pipeline-dark.png`, `02-pipeline-list.png`, `02-new-loan.png`, `03-loan-detail.png`, `03-loan-activity.png`, `03-loan-overview.png`, `04-queue.png`, `05-public-mobile-light.png`, `05-public-mobile-dark.png`, `05-public-desktop.png`, `05-public-done.png`, `05-public-expired.png`, `06-dashboard.png`, `06-dashboard-lo.png`, `07-users.png`, `07-impersonating.png`, `07-activity.png`, `08-components-light.png`, `08-components-dark.png`.
