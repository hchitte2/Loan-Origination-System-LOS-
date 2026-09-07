---
name: phase
description: Print a phase block from PLAN.md (the active phase, or phase N) with its tasks, done-when and verify steps. Use at the start of every coding session and whenever the current scope is unclear.
argument-hint: "[phase-number]"
allowed-tools: Bash(bash *), Read
---

## Phase block from PLAN.md

!`bash "${CLAUDE_PROJECT_DIR}/.claude/scripts/phase.sh" $ARGUMENTS`

## What to do with it

1. Restate the phase goal in one line. Check `git log --oneline -15` and the tree to see which tasks are already done.
2. Propose a short plan: ordered steps, files you will touch, what you will verify and how. Wait for approval.
3. Work the plan in small verified steps. Run `ui-reviewer` after UI work, `authz-reviewer` after server work, `schema-guard` before a migration.
4. Finish with `/verify` and walk the phase's done-when list, marking each item you can prove.

If no phase is marked active, stop and ask the user which phase to work on. The planning chat flips the status lines; do not edit PLAN.md yourself.
