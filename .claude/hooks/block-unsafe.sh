#!/bin/bash
# PreToolUse hook (matcher: Bash). Denies destructive or production-touching commands.
# Purpose: stop ACCIDENTS by a well-meaning coding agent, not a determined adversary.
# Fails open: any tooling problem exits 0 with no output. Denies by printing the documented
# JSON decision and exiting 0. macOS-safe: bash 3.2, BSD grep/sed/awk, needs jq.

set -f  # never glob-expand tokens against the hook's cwd

command -v jq >/dev/null 2>&1 || exit 0
input=$(cat 2>/dev/null) || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -n "$cmd" ] || exit 0

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# ---------------------------------------------------------------------------------------------
# 0. Release marker. Exactly two commands may touch production, written exactly like this.
# ---------------------------------------------------------------------------------------------
trimmed=$(printf '%s' "$cmd" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
case "$trimmed" in
  'CLEARLINE_RELEASE=1 pnpm db:migrate:prod'|'CLEARLINE_RELEASE=1 pnpm db:seed:prod') exit 0 ;;
esac
# Any other use of the marker as a command prefix is denied further down, after commit-message blanking.

# ---------------------------------------------------------------------------------------------
# Build $scan: the command with commit-message text blanked, so words inside -m "..." and inside
# quoted heredoc bodies are treated as data, not commands. Falls back to the raw command.
# ---------------------------------------------------------------------------------------------
scan=$(printf '%s\n' "$cmd" | awk '
  BEGIN { indoc = 0; delim = "" }
  {
    line = $0
    if (indoc) { if (line == delim) { indoc = 0 } ; print "HEREDOC_BODY"; next }
    # quoted heredoc start: <<'"'"'X'"'"' or <<"X"  (unquoted heredocs stay visible: the shell expands them)
    if (match(line, /<<-?[\047"][A-Za-z_][A-Za-z0-9_]*[\047"]/)) {
      d = substr(line, RSTART, RLENGTH); gsub(/<<-?/, "", d); gsub(/[\047"]/, "", d); delim = d; indoc = 1
    }
    # -m / --message arguments in single quotes, or in double quotes without $ or backtick
    gsub(/(-m|--message)([[:space:]]+|=)\047[^\047]*\047/, "-m MSG", line)
    gsub(/(-m|--message)([[:space:]]+|=)"[^"$`]*"/, "-m MSG", line)
    print line
  }' 2>/dev/null)
[ -n "$scan" ] || scan="$cmd"

# Exempt .env.example everywhere below: it is a committed template with no secrets.
scan=$(printf '%s' "$scan" | sed -E 's/\.env\.example/ENV_EXAMPLE_FILE/g')

# Shared fragments. A "word start" is anything that is not part of a word (covers quotes, "(", "`", "/").
WS='(^|[^[:alnum:]_.-])'
# A .env file reference: optional quote, optional directory prefix, .env with optional suffix or glob, optional quote, then a terminator.
ENVF='["'"'"']?([^[:space:]"'"'"';&|]*/)?\.env(\.[A-Za-z0-9_.*-]+|\*)?["'"'"']?([[:space:];&|),`]|$)'

# Split into shell segments (; | & and newlines) for per-command checks.
segments=$(printf '%s\n' "$scan" | tr ';|&' '\n\n\n')

# The release marker used as a command prefix anywhere except the two exact /release commands.
printf '%s\n' "$segments" | grep -Eq '^[[:space:]]*(env[[:space:]]+|export[[:space:]]+)?CLEARLINE_RELEASE=1' && deny "CLEARLINE_RELEASE=1 is reserved for exactly 'CLEARLINE_RELEASE=1 pnpm db:migrate:prod' and 'CLEARLINE_RELEASE=1 pnpm db:seed:prod' (see /release). Drop the prefix."

# ---------------------------------------------------------------------------------------------
# 1. Recursive deletes. rm with a recursive flag (split or long), rimraf, find -delete, xargs rm.
#    Allowed only when every target is a build cache or the scaffold temp dir.
# ---------------------------------------------------------------------------------------------
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
allowed_target() {
  t=$1
  t=$(printf '%s' "$t" | sed -E "s/^[\"']//; s/[\"']$//")           # strip quotes
  case "$t" in "$root"/*) t=${t#"$root"/} ;; esac                     # absolute path inside the project
  t=${t#./}
  t=${t%/}
  case "$t" in *'*'*|*'?'*|*'['*) return 1 ;; esac                    # globs cannot be validated
  first=${t%%/*}
  case "$first" in
    .next|node_modules|.turbo|coverage|playwright-report|test-results|.scaffold-tmp|dist|out) return 0 ;;
  esac
  return 1
}

if printf '%s' "$scan" | grep -Eq "${WS}(rm|rimraf)[[:space:]]|${WS}find[[:space:]][^;&|]*-delete|${WS}xargs[[:space:]][^;&|]*${WS}rm([[:space:]]|$)"; then
  printf '%s' "$scan" | grep -Eq "${WS}find[[:space:]][^;&|]*-delete" && deny "find -delete is denied; ask the user or use rm on a single build-cache directory."
  printf '%s' "$scan" | grep -Eq "${WS}xargs[[:space:]][^;&|]*${WS}rm([[:space:]]|$)" && deny "rm fed by xargs has no visible targets and is denied; ask the user."
  bad=0
  while IFS= read -r seg; do
    printf '%s' "$seg" | grep -Eq "${WS}(rm|rimraf)[[:space:]]" || continue
    args=$(printf '%s' "$seg" | sed -E 's/^.*[^[:alnum:]_.-](rm|rimraf)[[:space:]]+//; s/^(rm|rimraf)[[:space:]]+//')
    recursive=0; targets=""
    case "$seg" in *rimraf*) recursive=1 ;; esac
    for t in $args; do
      case "$t" in
        --recursive|-R) recursive=1 ;;
        --*) ;;
        -*[rR]*) recursive=1 ;;
        -*) ;;
        *) targets="$targets $t" ;;
      esac
    done
    [ "$recursive" -eq 1 ] || continue
    [ -n "$targets" ] || bad=1
    for t in $targets; do allowed_target "$t" || bad=1; done
  done <<EOF
$segments
EOF
  [ "$bad" -eq 0 ] || deny "Recursive delete is denied except on .next, node_modules, .turbo, coverage, playwright-report, test-results, dist, out and .scaffold-tmp (no globs). Ask the user for anything else."
fi

# ---------------------------------------------------------------------------------------------
# 2. History-destroying git.
# ---------------------------------------------------------------------------------------------
EOW='([[:space:]"'"'"'`)]|$)'
printf '%s' "$scan" | grep -Eq "git[[:space:]]+push[^;&|]*[[:space:]](--force[^[:space:]\"']*|-[A-Za-z]*f[A-Za-z]*|--delete|-d|\+[^[:space:]\"']+|:[^[:space:]\"']+)${EOW}" && deny "Force pushes (--force*, -f, +refspec) and remote branch deletion (--delete, -d, :refspec) are denied."
printf '%s' "$scan" | grep -Eq "git[[:space:]]+reset[^;&|]*[[:space:]]--hard${EOW}" && deny "git reset --hard is denied; ask the user."
printf '%s' "$scan" | grep -Eq "git[[:space:]]+clean[^;&|]*[[:space:]](-[A-Za-z]*f[A-Za-z]*|--force)${EOW}" && deny "git clean -f is denied; ask the user."
printf '%s' "$scan" | grep -Eq "git[[:space:]]+(checkout|restore)[^;&|]*[[:space:]](--[[:space:]]+)?\.${EOW}" && deny "Discarding the whole working tree is denied; name specific files or ask the user."
printf '%s' "$scan" | grep -Eq "git[[:space:]]+(checkout|switch)[^;&|]*[[:space:]](-f|--force|--discard-changes)${EOW}" && deny "Forced checkout/switch discards local changes and is denied."
printf '%s' "$scan" | grep -Eq "git[[:space:]]+branch[^;&|]*[[:space:]]-D${EOW}" && deny "Force-deleting branches is denied."
printf '%s' "$scan" | grep -Eq "git[[:space:]]+stash[[:space:]]+(drop|clear)${EOW}" && deny "Dropping stashes is denied; ask the user."

# ---------------------------------------------------------------------------------------------
# 3. Secrets and privilege.
# ---------------------------------------------------------------------------------------------
READERS='(cat|less|more|head|tail|bat|strings|grep|rg|sed|awk|cut|sort|uniq|wc|od|xxd|hexdump|source|open|code|pbcopy|cp|mv|ln|tee|scp|curl|python3?|node|bun|deno)'
printf '%s' "$scan" | grep -Eq "${WS}${READERS}[^;&|]*[[:space:]<(=,]${ENVF}" && deny "Reading or copying .env files is denied. Ask the user for variable names, never values. (.env.example is fine.)"
printf '%s' "$scan" | grep -Eq "${WS}\.[[:space:]]+${ENVF}" && deny "Sourcing .env files is denied."
printf '%s' "$scan" | grep -Eq ">>?[[:space:]]*${ENVF}" && deny "Writing .env files is denied. Update .env.example and tell the user what to set."
printf '%s' "$scan" | grep -Eq "${WS}env[[:space:]]*([0-9]?>|[|;&]|$)|${WS}env[[:space:]]+-[[:space:]]*$" && deny "Dumping the environment is denied."
printf '%s' "$scan" | grep -Eq "${WS}printenv([[:space:]]|$)" && deny "printenv is denied. Test presence with [ -n \"\$VAR\" ]; never print values."
printf '%s' "$scan" | grep -Eq "(echo|printf)[^;&|]*\\\$\{?[A-Za-z_]*(DATABASE_URL|SECRET|TOKEN|PASSWORD|API_KEY|CRON)|process\.env\.[A-Z_]*(DATABASE_URL|SECRET|TOKEN|PASSWORD|API_KEY|CRON)" && deny "Printing secret values is denied. Test presence with [ -n \"\$VAR\" ]."
printf '%s' "$scan" | grep -Eq "${WS}rg[^;&|]*[[:space:]](-[A-Za-z.]*u[A-Za-z.]*u[A-Za-z.]*|--unrestricted|-[A-Za-z]*u[A-Za-z]*\.[A-Za-z.]*|-[A-Za-z]*\.[A-Za-z]*u[A-Za-z.]*)([[:space:]]|$)|${WS}rg[^;&|]*--no-ignore[^;&|]*--hidden|${WS}rg[^;&|]*--hidden[^;&|]*--no-ignore" && deny "rg with ignore rules and hidden files both disabled would print .env contents; search without -uu / --no-ignore --hidden."
printf '%s' "$scan" | grep -Eq "${WS}sudo([[:space:]]|$)" && deny "sudo is denied."

# ---------------------------------------------------------------------------------------------
# 4. Schema, production and platform footguns.
# ---------------------------------------------------------------------------------------------
printf '%s' "$scan" | grep -Eq "drizzle-kit[[:space:]]+push|${WS}db:push" && deny "drizzle-kit push is denied. Use pnpm db:generate, review the SQL, then pnpm db:migrate."
printf '%s' "$scan" | grep -Eq "db:(migrate|seed):prod" && deny "db:migrate:prod and db:seed:prod run only through /release, written exactly as 'CLEARLINE_RELEASE=1 pnpm db:migrate:prod'."
printf '%s' "$scan" | grep -Eq "\.env\.production" && deny "Production env files are handled by the user and /release only."
printf '%s' "$scan" | grep -Eq "vercel[[:space:]]+env[[:space:]]+pull[^;&|]*production" && deny "Pulling production env is the user's job (see /release)."
printf '%s' "$scan" | grep -Eq "vercel[[:space:]]+(env[[:space:]]+rm|project[[:space:]]+rm|rm|remove|domains[[:space:]]+rm|--prod)([[:space:]]|$)" && deny "Removing Vercel resources or deploying with --prod from the shell is denied; deploys happen on git push."
printf '%s' "$scan" | grep -Eiq "(psql|pgcli|neonctl|postgres(ql)?://)[^;&|]*(drop[[:space:]]+(table|schema|database)|truncate)" && deny "DROP/TRUNCATE from the shell is denied. Schema changes go through migrations; resets go through pnpm db:reset."

# Shell-side mirror of protect-files.sh: never write, move or delete migrations or drizzle metadata from the shell.
printf '%s' "$scan" | grep -Eq "(>>?[[:space:]]*|${WS}(tee|mv|rm|cp)[^;&|]*[[:space:]]|${WS}(sed|perl)[^;&|]*[[:space:]]-[A-Za-z]*i[^;&|]*[[:space:]])[\"']?([^[:space:]\"']*/)?drizzle/(meta(/|[[:space:]\"']|$)|[^[:space:]\"']*\.sql)" && deny "Migrations and drizzle/meta are never edited from the shell. Use pnpm db:generate; edit an uncommitted migration with the Edit tool."

# ---------------------------------------------------------------------------------------------
# 5. Production database host (from .claude/prod-db-host). Matches the Neon endpoint id so both the
#    direct and the -pooler hostnames are caught; case-insensitive.
# ---------------------------------------------------------------------------------------------
hostfile="$root/.claude/prod-db-host"
if [ -f "$hostfile" ]; then
  while IFS= read -r host || [ -n "$host" ]; do
    host=$(printf '%s' "$host" | tr -d '[:space:]')
    case "$host" in ''|'#'*) continue ;; esac
    key=$host
    case "$host" in ep-*) key=${host%%.*}; key=${key%-pooler} ;; esac
    if printf '%s' "$cmd" | grep -Fiq -- "$key"; then
      deny "This command names the production database ($key). Production is touched only through /release."
    fi
  done < "$hostfile"
fi

exit 0
