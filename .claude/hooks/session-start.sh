#!/bin/bash
# SessionStart hook: tell the session which PLAN.md phase is active and whether the tree is dirty.
# Fails open: any problem exits 0 silently. macOS-safe (bash 3.2, BSD awk/grep).

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f PLAN.md ] || exit 0

phase=$(awk '/^### Phase /{h=$0} /^Status: active/{print h; exit}' PLAN.md 2>/dev/null)
[ -n "$phase" ] || phase="none marked active (ask the user which phase to work on)"

dirty="none"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  n=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  [ "$n" != "0" ] && dirty="$n path(s) uncommitted (git status --short)"
fi

ctx="Clearline session. Active phase from PLAN.md: ${phase#\#\#\# }. Run /phase to print its block and read it before planning. Working tree: ${dirty}. Reviewers: ui-reviewer after UI work, authz-reviewer after server work, schema-guard before migrations. Finish with /verify."

if command -v jq >/dev/null 2>&1; then
  jq -n --arg c "$ctx" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}'
else
  printf '%s\n' "$ctx"
fi
exit 0
