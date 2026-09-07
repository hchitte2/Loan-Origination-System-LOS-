#!/bin/bash
# Print one phase block from PLAN.md.
# Usage: phase.sh [n]   With no argument, prints the phase whose block contains "Status: active".
# macOS-safe (bash 3.2, BSD awk).

f="${CLAUDE_PROJECT_DIR:-.}/PLAN.md"
[ -f "$f" ] || { echo "PLAN.md not found at $f"; exit 0; }
n="$1"

if [ -n "$n" ]; then
  awk -v n="$n" '
    /^### Phase / { p = ($3 == n); if (p) print; next }
    /^## [0-9]/    { p = 0 }
    /^---$/        { p = 0 }
    p              { print }
  ' "$f"
else
  awk '
    /^### Phase / || /^## [0-9]/ || /^---$/ { if (active) exit; block = "" }
    { block = block $0 "\n" }
    /^Status: active/ { active = 1 }
    END { if (active) printf "%s", block }
  ' "$f"
fi
