#!/bin/bash
# Stop hook: a turn may not end on a broken tree. Runs tsc, biome check and the fast unit tests.
# Fails open on tooling problems (exit 0); blocks only on real findings (exit 2, first 40 lines on stderr).
# Exits 0 when stop_hook_active is set so an unfixable failure cannot loop forever.

input=$(cat 2>/dev/null)
if command -v jq >/dev/null 2>&1; then
  active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)
  [ "$active" = "true" ] && exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f package.json ] || exit 0
[ -d node_modules ] || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0

fail() {
  printf '%s\n' "$1" >&2
  printf '%s\n' "$2" | head -40 >&2
  exit 2
}

# Prefer the project's typecheck script: it runs `next typegen` first so Next's generated
# PageProps/LayoutProps globals exist on a fresh clone. Bare tsc is only the fallback.
if grep -q '"typecheck"[[:space:]]*:' package.json 2>/dev/null; then
  out=$(pnpm typecheck 2>&1) || fail "TypeScript errors. Fix them before ending the turn (never silence with 'as any' or @ts-ignore):" "$out"
elif [ -f tsconfig.json ]; then
  out=$(pnpm exec tsc --noEmit 2>&1) || fail "TypeScript errors. Fix them before ending the turn (never silence with 'as any' or @ts-ignore):" "$out"
fi

if [ -f biome.json ] || [ -f biome.jsonc ]; then
  out=$(pnpm exec biome check . 2>&1) || fail "Biome lint/format errors. Fix them before ending the turn:" "$out"
fi

if grep -q '"test"[[:space:]]*:' package.json 2>/dev/null; then
  out=$(pnpm test 2>&1) || fail "Unit tests failed. Fix them before ending the turn:" "$out"
fi

exit 0
