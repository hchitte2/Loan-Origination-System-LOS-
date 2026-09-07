# Hook fixture battery

`fixtures.txt` holds one command per line, prefixed `D` (must be denied) or `A` (must be allowed), tab-separated. `run.sh` feeds each through `.claude/hooks/block-unsafe.sh` exactly as Claude Code would (JSON on stdin, `CLAUDE_PROJECT_DIR` set) and also checks multi-line commit heredocs and the production-host rule.

Run after any change to the hook:

```
bash .claude/hooks/tests/run.sh "$PWD"
```

Expected: `PASS=<n> FAIL=0`. Add a fixture line for every new rule and for every false positive you fix.
