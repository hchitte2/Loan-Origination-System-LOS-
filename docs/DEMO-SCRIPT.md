# Clearline · 12-minute demo script

Production: https://clearline-gilt.vercel.app · Everything is synthetic and resets at 08:00 UTC.

## Before you start (5 minutes before)
- Open the URL, enter as Priya, land on the dashboard. This wakes the database; every click after it is fast.
- Second window ready: a private/incognito window, or your phone, for the borrower step.
- Have `src/db/specimens/specimen-pay-stub.pdf` on the desktop (any PDF or photo under 10 MB works).
- If the data looks used, Priya → Users → **Reset demo data** → confirm. Takes under a minute.
- Do NOT create a loan at "412 Maple Ave". That is the seeded showcase loan; you would get two Chen rows on the board.

## 0. Framing · 30 s
"Clearline is a small loan origination system for a mortgage shop. Three roles work one loan file: a loan officer, a processor, and the borrower, who never logs in. A superadmin sees everything and can step into anyone's shoes. It's a demo, so the data is synthetic and resets nightly."

## 1. Login · 30 s
Point at the three cards. "No passwords in a demo. And this button opens what a borrower gets: a private link, no account." Click **Enter as Priya Nair**.

## 2. Priya, the owner · 2 min
Dashboard. Read the four tiles aloud: active pipeline, funded this month, pull-through, cycle time. Click the small info button on **Pull-through**: "every number explains itself." Scroll to **Needs attention**: "stalled files and closings at risk, in one list. This is what an owner opens at 8 am."
Users → **View as** next to Alex Rivera. The amber banner appears: "I'm now seeing exactly what Alex sees. Her navigation, her loans. The banner is the only thing that gives it away."

## 3. As Alex, the loan officer · 3 min
Pipeline. "Six columns, one per stage. Column headers carry count and dollars." Toggle **Board / List** once and back. Set **Mine** and back to **All**.
Click **New loan**: borrower **Jordan Nakamura**, email `jordan.nakamura@example.com`, property **88 Willow Bend, Austin TX 78704**, purchase, conventional, **$455,000**, target close about a month out. **Create loan**. "Six needs-list items were created for a purchase file." Open the card's **Move to…** → **Move to Application**, then again → **Move to Processing**. "Moves go through a state machine; the wrong move is not offered."
Now open the seeded loan **Chen · 412 Maple Ave** (Processing, 6 days). Overview tab: **Copy Maria's link**. "This is what goes to the borrower by text or email. Regenerating it kills the old one."

## 4. Maria, the borrower · 2 min
Paste the link in the private window or open it on your phone. "No login. Her name, where the loan stands, what's needed, in plain words." Point at the milestone tracker and the six cards. Tap **Tap to upload** on **Pay stubs, last 30 days** and choose the specimen PDF. The card flips to **Received, under review**. "She never sees a stage name or the word pending."

## 5. Sam, the processor · 3 min
Back in the main window: **Exit view** → Users → **View as** Sam Okafor. Queue: "everything waiting for a decision, oldest first." Open the Chen loan → Needs list → expand **Pay stubs** → **Reject** with reason `Only one stub; we need 30 days` → **Reject document**.
Flip to Maria's window and refresh: **Needs another: Only one stub; we need 30 days**. "Her wording, not ours." Upload the same file again.
Back as Sam: refresh, **Accept**, then answer **Clear condition** in the dialog. "Accepting the last document asks whether the condition itself is done." Click **Submit to underwriting**, then **Issue conditional approval**. Hover the tooltip: "in production an underwriter presses this; we fold that role into the processor for the demo."

## 6. The honest audit log · 1.5 min
**Exit view**. As Priya, open the Chen loan → **Activity**. Read: "**Priya Nair (viewing as Sam Okafor)** rejected Pay stubs…" "The log records the human, not the costume. The table cannot be edited or deleted; the database refuses." Then **Activity** in the sidebar, filter **Impersonation**: the started and stopped rows.
Persona chip → **Dark**. "Same tokens, second theme." Switch back.

## 7. Close · 30 s
"Free to run: Vercel, Neon and Blob, nothing sleeps. Uploads are capped, the data resets every morning, and every action is on the record."
For engineers, one extra minute: open the repo, show `PLAN.md`, `CLAUDE.md`, the `.claude/` folder, and the `phase-1` … `phase-5` tags. "Built with Claude Code from a written plan: one branch and one pull request per phase, reviewer agents, and a hook that refuses to end a turn on a broken build."

## If something goes wrong
- A page is slow on first click: the database was asleep; the next click is fast.
- Upload refused: file over 10 MB, or the daily cap is reached; say so and move on, the seeded documents on Chen show the same states.
- Wrong data on screen: Priya → Users → **Reset demo data**, then start at step 2.
