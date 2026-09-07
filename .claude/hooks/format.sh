#!/bin/bash
# PostToolUse hook (matcher: Edit|Write). Formats the touched file with Biome. Never blocks, never prints.

command -v jq >/dev/null 2>&1 || exit 0
path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$path" ] && [ -f "$path" ] || exit 0

case "$path" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.jsonc|*.css) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f biome.json ] || [ -f biome.jsonc ] || exit 0
[ -d node_modules ] || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0

pnpm exec biome format --write "$path" >/dev/null 2>&1 || true
exit 0
