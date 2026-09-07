#!/bin/bash
# Stop hook: a session may not end with a broken TypeScript build.
# Fail open: any tooling problem exits 0 silently; only real type errors block.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f package.json ] || exit 0
[ -f tsconfig.json ] || exit 0
command -v npx >/dev/null 2>&1 || exit 0

out=$(npx tsc --noEmit 2>&1)
if [ $? -ne 0 ]; then
  echo "TypeScript errors. Fix these before finishing the turn:" >&2
  echo "$out" | head -40 >&2
  exit 2
fi
exit 0
