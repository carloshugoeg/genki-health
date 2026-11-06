#!/usr/bin/env bash
# Local gate mirroring CI (architecture §7.3). Carlos owns this script.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> npm ci (or install)"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "==> prettier --check"
npm run format:check

echo "==> eslint"
npm run lint

echo "==> build shared"
npm run build -w @genki/shared

echo "==> tsc --noEmit (workspaces)"
npm run typecheck

echo "==> dependency-cruiser (hexagonal rules)"
npm run depcruise

echo "==> vitest (shared + server)"
npm test

echo "==> protocol tests (node --test scripts/test)"
npm run test:protocol

echo "==> build web"
npm run build -w @genki/web

echo "==> journal gate"
JOURNAL_BASE="${JOURNAL_GATE_BASE:-}"
JOURNAL_HEAD="${JOURNAL_GATE_HEAD:-HEAD}"
if [[ -z "$JOURNAL_BASE" ]]; then
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    JOURNAL_BASE="$(git merge-base origin/main HEAD)"
  else
    echo "skip journal gate (set JOURNAL_GATE_BASE or fetch origin/main)"
    JOURNAL_BASE=""
  fi
fi
if [[ -n "$JOURNAL_BASE" ]]; then
  node scripts/journal-gate.mjs --base "$JOURNAL_BASE" --head "$JOURNAL_HEAD"
fi

echo "validate.sh OK"
