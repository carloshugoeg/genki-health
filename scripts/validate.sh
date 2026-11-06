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

echo "==> build web"
npm run build -w @genki/web

echo "validate.sh OK"
