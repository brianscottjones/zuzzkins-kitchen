#!/usr/bin/env bash
# scripts/deploy.sh — Zuzzkin's Kitchen build-and-deploy pipeline
#
# Usage:
#   ./scripts/deploy.sh                      # full pipeline: test → build → test → deploy
#   ./scripts/deploy.sh --dry-run            # same, but skip the actual deploy
#   ./scripts/deploy.sh --message "my msg"   # custom git commit message
#   ./scripts/deploy.sh --skip-pre-tests     # skip pre-build tests (faster for content-only changes)
#
# Environment variables:
#   DEPLOY_MSG  — commit message (overrides --message flag)
#   SKIP_DEPLOY — set to "1" to behave like --dry-run

set -euo pipefail

# ── Resolve project root (the dir containing package.json) ────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# ── Defaults ─────────────────────────────────────────────────────────────────
DRY_RUN=false
SKIP_PRE=false
COMMIT_MSG="${DEPLOY_MSG:-Deploy: $(date '+%Y-%m-%d %H:%M')}"
PASS=0
FAIL=0

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)         DRY_RUN=true ;;
    --skip-pre-tests)  SKIP_PRE=true ;;
    --message|-m)      shift; COMMIT_MSG="$1" ;;
    --help|-h)
      grep '^#' "$0" | head -20 | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
  shift
done

# Honor env var override
[[ "${SKIP_DEPLOY:-0}" == "1" ]] && DRY_RUN=true

# ── Helpers ───────────────────────────────────────────────────────────────────

step() { echo -e "\n${CYAN}${BOLD}▶ $*${RESET}"; }
pass() { echo -e "${GREEN}  ✓ $*${RESET}"; (( PASS++ )) || true; }
fail() { echo -e "${RED}  ✗ $*${RESET}"; (( FAIL++ )) || true; }
warn() { echo -e "${YELLOW}  ⚠ $*${RESET}"; }

run_tests() {
  local label="$1"
  local file="$2"

  if [[ ! -f "$file" ]]; then
    fail "Test file not found: $file"
    return 1
  fi

  echo ""
  echo -e "${BOLD}  Running $label...${RESET}"
  if node --test "$file" 2>&1 | sed 's/^/    /'; then
    pass "$label passed"
  else
    fail "$label failed"
    return 1
  fi
}

abort() {
  echo ""
  echo -e "${RED}${BOLD}✗ Pipeline aborted: $*${RESET}"
  echo -e "${RED}  $FAIL check(s) failed.${RESET}"
  exit 1
}

# ── Pipeline ──────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Zuzzkin's Kitchen — Deploy Pipeline${RESET}"
echo -e "${BOLD}════════════════════════════════════════════════${RESET}"
$DRY_RUN && warn "DRY RUN — deploy step will be skipped"
echo ""
echo "  Project: $ROOT"
echo "  Commit:  $COMMIT_MSG"
echo ""

# ── Step 1: Pre-build tests ───────────────────────────────────────────────────

if ! $SKIP_PRE; then
  step "Step 1/4 — Pre-build tests (source validation)"
  run_tests "Pre-build tests" "tests/pre-build.test.mjs" || abort "Pre-build tests failed"
else
  warn "Pre-build tests skipped (--skip-pre-tests)"
fi

# ── Step 2: Build ─────────────────────────────────────────────────────────────

step "Step 2/4 — Build (npm run build)"
echo ""
if npm run build 2>&1 | sed 's/^/  /'; then
  pass "Build succeeded"
else
  abort "Build failed"
fi

# ── Step 3: Post-build tests ──────────────────────────────────────────────────

step "Step 3/4 — Post-build tests (HTML validation, links, content)"
run_tests "Post-build tests" "tests/post-build.test.mjs" || abort "Post-build tests failed"

# ── Step 4: Deploy ────────────────────────────────────────────────────────────

step "Step 4/4 — Deploy"

if $DRY_RUN; then
  warn "Dry run — skipping git add / commit / push"
  echo ""
  echo -e "${GREEN}${BOLD}✓ Dry run complete — all $PASS checks passed!${RESET}"
  echo -e "${YELLOW}  Run without --dry-run to actually deploy.${RESET}"
  exit 0
fi

echo ""
echo "  Staging all changes..."
git add -A

# Check if there's anything to commit
if git diff --staged --quiet; then
  warn "Nothing new to commit (working tree clean)"
else
  git commit -m "$COMMIT_MSG"
  pass "Committed: $COMMIT_MSG"
fi

echo "  Pushing to remote..."
if git push; then
  pass "Pushed to remote"
else
  abort "git push failed"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  ✓ Deploy complete!  ($PASS checks passed)${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${RESET}"
echo ""
