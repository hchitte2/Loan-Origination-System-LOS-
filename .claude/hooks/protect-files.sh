#!/bin/bash
# PreToolUse hook (matcher: Edit|Write). Denies edits to committed migrations, drizzle metadata and .env files.
# Fails open: any tooling problem exits 0 silently. macOS-safe (bash 3.2), needs jq.

command -v jq >/dev/null 2>&1 || exit 0
input=$(cat 2>/dev/null) || exit 0
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$path" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
case "$path" in
  "$root"/*) rel="${path#"$root"/}" ;;
  *) rel="$path" ;;
esac
base=$(basename -- "$path")

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

case "$base" in
  .env.example) ;;
  .env|.env.*) deny ".env files are edited by the user, never by Claude. Update .env.example and tell the user what to set." ;;
esac

case "$rel" in
  drizzle/meta/*)
    deny "drizzle/meta is managed by drizzle-kit; never hand-edit it." ;;
  drizzle/*.sql)
    # A migration becomes immutable once it is committed. Uncommitted (just generated) files may still be edited.
    if [ -f "$path" ] && git -C "$root" ls-files --error-unmatch -- "$rel" >/dev/null 2>&1; then
      deny "Committed migrations are immutable. Run pnpm db:generate to create a new migration instead of editing $rel."
    fi ;;
esac

exit 0
