#!/bin/bash
# Fixture battery for .claude/hooks/block-unsafe.sh. Usage: bash run.sh <repo>
repo="$1"; here=$(cd "$(dirname "$0")" && pwd)
export CLAUDE_PROJECT_DIR="$repo"
hook="$repo/.claude/hooks/block-unsafe.sh"
bash -n "$hook" || { echo "SYNTAX ERROR"; exit 1; }

run() { printf '%s' "$1" | jq -Rs '{tool_name:"Bash",tool_input:{command:.}}' | /bin/bash "$hook"; }
pass=0; fail=0
while IFS=$'\t' read -r expect cmd; do
  [ -n "$cmd" ] || continue
  out=$(run "$cmd")
  if [ "$expect" = "D" ]; then
    if printf '%s' "$out" | grep -q '"deny"'; then pass=$((pass+1)); else fail=$((fail+1)); echo "!! ALLOWED (expected deny): $cmd"; fi
  else
    if [ -z "$out" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "!! DENIED (expected allow): $cmd -> $(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecisionReason')"; fi
  fi
done < "$here/fixtures.txt"

# Multi-line commit with a quoted heredoc body that mentions denied phrases: must ALLOW.
multi=$(printf 'git commit -m "$(cat <<'"'"'EOF'"'"'\nfeat(hooks): guardrails\n\nDeny rm -rf src, cat .env.local, drizzle-kit push and git push --force.\nEOF\n)"')
out=$(run "$multi")
if [ -z "$out" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "!! DENIED (expected allow): multi-line commit heredoc -> $(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecisionReason')"; fi

# Unquoted heredoc that actually writes a .env file: must DENY.
multi2=$(printf 'cat <<EOF > .env.local\nDATABASE_URL=x\nEOF')
out=$(run "$multi2")
if printf '%s' "$out" | grep -q '"deny"'; then pass=$((pass+1)); else fail=$((fail+1)); echo "!! ALLOWED (expected deny): heredoc writing .env.local"; fi

# Production host: direct, pooled, uppercase, inline env; and the exact release command still allowed.
hostfile="$repo/.claude/prod-db-host"
cp "$hostfile" "$hostfile.bak"
printf 'ep-quiet-forest-123456.us-east-2.aws.neon.tech\n' >> "$hostfile"
for c in \
  'psql postgres://u:p@ep-quiet-forest-123456.us-east-2.aws.neon.tech/db' \
  'psql postgres://u:p@ep-quiet-forest-123456-pooler.us-east-2.aws.neon.tech/db' \
  'DATABASE_URL=postgres://u:p@EP-QUIET-FOREST-123456.us-east-2.aws.neon.tech/db pnpm db:seed' \
  'echo ep-quiet-forest-123456 > notes.txt'; do
  out=$(run "$c")
  if printf '%s' "$out" | grep -q '"deny"'; then pass=$((pass+1)); else fail=$((fail+1)); echo "!! ALLOWED (expected deny): $c"; fi
done
for c in 'CLEARLINE_RELEASE=1 pnpm db:migrate:prod' 'psql postgres://u:p@ep-other-branch-999.us-east-2.aws.neon.tech/db'; do
  out=$(run "$c")
  if [ -z "$out" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "!! DENIED (expected allow): $c"; fi
done
mv "$hostfile.bak" "$hostfile"

echo "PASS=$pass FAIL=$fail"
[ "$fail" -eq 0 ]
