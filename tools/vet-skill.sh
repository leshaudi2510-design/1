#!/usr/bin/env bash
# Scan gate for anything entering .claude/, .mcp.json or tools/ (MASTER-PLAN D-15, TOOLKIT-SCOUT step 2).
# A scanner that cannot start is never skipped silently: exit 70.
set -u

usage() {
  cat <<'EOF'
Usage: bash tools/vet-skill.sh <path> [--scanners agentshield|skillspector|agentshield,skillspector] [--baseline FILE] [--min-severity L] [--out DIR]

Runs the security scanners over <path> (a skill folder, .claude/, a plugin
checkout) and fails on findings.

  agentshield   node $AGENTSHIELD_LOCAL (default /home/user/affaan-m/agentshield/dist/index.js)
                when that clone starts, else the pinned npx -y ecc-agentshield@1.6.0;
                "scan --path <path> --format json --output <out>/agentshield.json"
                (with --baseline FILE: "--baseline FILE --gate", regressions only)
  skillspector  skillspector v2.12.0 (uv tool; Phase 2 setup script):
                "scan <path> [--recursive] --no-llm --format json --output <out>/skillspector.json
                 --baseline .skillspector-baseline.yaml --fail-on-findings"

Default scanners: agentshield,skillspector. Phase 1 CI and E's done-when use
--scanners agentshield (SkillSpector needs uv, which the setup script adds in Phase 2).

  --min-severity L  agentshield only: ignore findings below L (low|medium|high|critical)
  --out DIR     where the JSON reports go (default $CLAUDE_SCRATCHPAD/vet or $TMPDIR)
  --help        this text

Exit codes: 0 clean, 1 findings, 2 usage error, 70 a requested scanner cannot start.
EOF
}

TARGET=""; SCANNERS="agentshield,skillspector"; BASELINE=""; OUT=""; MINSEV=""
while [ $# -gt 0 ]; do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --scanners) SCANNERS="${2:-}"; shift 2 ;;
    --scanners=*) SCANNERS="${1#*=}"; shift ;;
    --baseline) BASELINE="${2:-}"; shift 2 ;;
    --baseline=*) BASELINE="${1#*=}"; shift ;;
    --out) OUT="${2:-}"; shift 2 ;;
    --min-severity) MINSEV="${2:-}"; shift 2 ;;
    --min-severity=*) MINSEV="${1#*=}"; shift ;;
    --out=*) OUT="${1#*=}"; shift ;;
    -*) echo "vet-skill: unknown option $1" >&2; usage >&2; exit 2 ;;
    *) if [ -z "$TARGET" ]; then TARGET="$1"; else echo "vet-skill: one path only" >&2; exit 2; fi; shift ;;
  esac
done
[ -n "$TARGET" ] || { echo "vet-skill: give a path to scan" >&2; usage >&2; exit 2; }
[ -e "$TARGET" ] || { echo "vet-skill: $TARGET does not exist" >&2; exit 2; }
[ -n "$SCANNERS" ] || { echo "vet-skill: --scanners needs a value" >&2; exit 2; }
OUT="${OUT:-${CLAUDE_SCRATCHPAD:-${TMPDIR:-/tmp}}/vet}"
mkdir -p "$OUT" || { echo "vet-skill: cannot create $OUT" >&2; exit 2; }

AGENTSHIELD_LOCAL="${AGENTSHIELD_LOCAL:-/home/user/affaan-m/agentshield/dist/index.js}"
AGENTSHIELD_PIN="ecc-agentshield@1.6.0"
SKILLSPECTOR_VERSION="2.12.0"
status=0

run_agentshield() {
  local cmd=()
  if [ -f "$AGENTSHIELD_LOCAL" ] && node "$AGENTSHIELD_LOCAL" --version >/dev/null 2>&1; then
    cmd=(node "$AGENTSHIELD_LOCAL")
  elif command -v npx >/dev/null 2>&1 && [ "$(npx -y "$AGENTSHIELD_PIN" --version 2>/dev/null | tail -1)" = "1.6.0" ]; then
    cmd=(npx -y "$AGENTSHIELD_PIN")
  else
    echo "vet-skill: agentshield is not runnable (local clone $AGENTSHIELD_LOCAL failed and npx -y $AGENTSHIELD_PIN did not print 1.6.0)" >&2
    exit 70
  fi
  local report="$OUT/agentshield.json"
  local extra=()
  [ -n "$BASELINE" ] && extra=(--baseline "$BASELINE" --gate)
  [ -n "$MINSEV" ] && extra+=(--min-severity "$MINSEV")
  "${cmd[@]}" scan --path "$TARGET" --format json --output "$report" "${extra[@]}" >"$OUT/agentshield.log" 2>&1
  local rc=$?
  if [ $rc -eq 0 ]; then
    echo "vet-skill: agentshield ($(basename "${cmd[-1]}")) clean: $TARGET (report $report)"
  elif [ $rc -eq 2 ] || { [ $rc -eq 1 ] && [ -s "$report" ]; }; then
    local n
    n=$(node -e 'try{const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const f=r.findings||(r.results||[]).flatMap(x=>x.findings||[])||[];console.log(Array.isArray(f)?f.length:"?")}catch{console.log("?")}' "$report")
    echo "vet-skill: agentshield found $n finding(s) in $TARGET (report $report)" >&2
    status=1
  else
    echo "vet-skill: agentshield exited $rc without a report (see $OUT/agentshield.log)" >&2
    tail -5 "$OUT/agentshield.log" >&2
    exit 70
  fi
}

run_skillspector() {
  if ! command -v skillspector >/dev/null 2>&1 || ! skillspector --version 2>/dev/null | grep -q "$SKILLSPECTOR_VERSION"; then
    echo "vet-skill: skillspector v$SKILLSPECTOR_VERSION is not runnable (install: uv tool install --python 3.12 'skillspector[mcp] @ git+https://github.com/NVIDIA/skillspector.git@v$SKILLSPECTOR_VERSION'); use --scanners agentshield in Phase 1" >&2
    exit 70
  fi
  local report="$OUT/skillspector.json"
  local args=(scan "$TARGET" --no-llm --format json --output "$report" --fail-on-findings)
  [ -f "$TARGET/SKILL.md" ] || args+=(--recursive)
  [ -f .skillspector-baseline.yaml ] && args+=(--baseline .skillspector-baseline.yaml)
  skillspector "${args[@]}" >"$OUT/skillspector.log" 2>&1
  local rc=$?
  if [ $rc -eq 0 ]; then echo "vet-skill: skillspector clean: $TARGET (report $report)"
  elif [ -s "$report" ]; then echo "vet-skill: skillspector found findings in $TARGET (report $report)" >&2; status=1
  else echo "vet-skill: skillspector exited $rc without a report (see $OUT/skillspector.log)" >&2; exit 70
  fi
}

IFS=',' read -r -a list <<<"$SCANNERS"
for s in "${list[@]}"; do
  case "$s" in
    agentshield) run_agentshield ;;
    skillspector) run_skillspector ;;
    *) echo "vet-skill: unknown scanner $s (agentshield, skillspector)" >&2; exit 2 ;;
  esac
done
exit $status
