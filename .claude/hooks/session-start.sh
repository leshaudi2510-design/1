#!/usr/bin/env bash
# Original (site factory). SessionStart hook (SPEC 8, MASTER-PLAN 5.4, ECC-ADOPTION A-79, A-101).
# Design reference: everything-claude-code scripts/hooks/session-start.js @ ef648e01 (MIT); no code copied.
# Prints plain context text (SessionStart stdout is added to the model's context). Always exits 0.
# Steps: npm ci when node_modules is missing (cloud sessions only), Chromium check, SITE_SLUG/FACTORY_ROLE
# from the branch into $CLAUDE_ENV_FILE, spoke deny rules into .claude/settings.local.json (gitignored),
# tools/worktree-gc.sh, git fetch origin registry, status + Board link, then lib/state-load.mjs.

LOG="${TMPDIR:-/tmp}/factory-session-start.log"   # hook output that is not context goes here, never to /dev/null
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$ROOT" 2>>"$LOG" || exit 0
[ "${FACTORY_HOOKS:-on}" = "off" ] && exit 0

INPUT=""
if [ ! -t 0 ]; then INPUT="$(timeout 2 cat 2>>"$LOG" || true)"; fi
export FACTORY_HOOK_INPUT="$INPUT"

say() { printf '%s\n' "$*"; }

# 1. Dependencies (cloud only: a local checkout is the operator's to manage).
if [ -f package-lock.json ] && [ ! -d node_modules ]; then
  if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || [ "${FACTORY_NPM_CI:-}" = "1" ]; then
    if timeout 300 npm ci --no-audit --no-fund >>"$LOG" 2>&1; then say "factory: npm ci done"; else say "factory: npm ci failed or timed out; run it by hand (Bash timeout 600000)"; fi
  else
    say "factory: node_modules missing; run npm ci"
  fi
fi

# 2. Chromium for check.mjs / lighthouse.mjs (never install into ~/.cache/ms-playwright).
PW="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
if ! ls -d "$PW"/chromium-* >>"$LOG" 2>&1; then
  say "factory: no Chromium under $PW; install with: PLAYWRIGHT_BROWSERS_PATH=$PW npx playwright install chromium"
fi

# 3. Role and slug from the branch (site/<slug>, wip/<slug>/*; everything else is the hub).
BRANCH="$(git symbolic-ref --short -q HEAD 2>>"$LOG" || true)"
SLUG=""; ROLE="${FACTORY_ROLE:-}"
case "$BRANCH" in
  site/*) SLUG="${BRANCH#site/}"; ROLE="spoke" ;;
  wip/*/*) SLUG="${BRANCH#wip/}"; SLUG="${SLUG%%/*}"; ROLE="spoke" ;;
esac
[ -z "$ROLE" ] && ROLE="hub"
[ -z "$SLUG" ] && SLUG="${SITE_SLUG:-}"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    printf 'export FACTORY_ROLE=%q\n' "$ROLE"
    [ -n "$SLUG" ] && printf 'export SITE_SLUG=%q\n' "$SLUG"
  } >> "$CLAUDE_ENV_FILE" 2>>"$LOG"
fi

# 4. Spokes and routines may not write the registry (SPEC 8, D6).
if [ "$ROLE" != "hub" ] && [ ! -f .claude/settings.local.json ]; then
  cat > .claude/settings.local.json <<'JSON'
{
  "permissions": {
    "deny": [
      "Bash(node tools/registry.mjs reserve*)",
      "Bash(node tools/registry.mjs refresh*)",
      "Bash(node tools/registry.mjs release*)",
      "Bash(node tools/registry.mjs ingest*)",
      "Bash(node tools/registry.mjs stage*)",
      "Bash(node tools/registry.mjs janitor*)"
    ]
  }
}
JSON
fi

# 5. Housekeeping (Phase 2 tools are optional; failures never block a session).
[ -f tools/worktree-gc.sh ] && timeout 60 bash tools/worktree-gc.sh >>"$LOG" 2>&1
timeout 20 git fetch origin registry --quiet >>"$LOG" 2>&1

# 6. Status line and Board link.
say "factory: role $ROLE${SLUG:+ | site $SLUG} | branch ${BRANCH:-detached}"
if [ -f tools/status.mjs ]; then
  timeout 30 node tools/status.mjs --mine --offline-ok 2>>"$LOG" | head -n 20
fi
BOARD="$(node -e "try{const f=require('./.claude/factory.json');process.stdout.write(f.boardUrl||'')}catch{}" 2>>"$LOG")"
[ -n "$BOARD" ] && say "factory: Board $BOARD"

# 7. Guarded memory block (session summary, open questions, siblings, promoted lessons; invariants after compaction).
SITE_SLUG="$SLUG" FACTORY_ROLE="$ROLE" timeout 10 node .claude/hooks/lib/state-load.mjs 2>>"$LOG"
exit 0
