#!/usr/bin/env bash
# Retired by E2-P2-06: the C3.4 memory suite is mandatory green.
# Kept as a thin wrapper so older docs/scripts that invoke the name still run the suite.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> expect-contract-red (retired): memory contract must be green"
npm run build -w @genki/shared
npm test -w @genki/server -- test/contracts/memory.test.ts
echo "expect-contract-red: suite green (P2-06)"
echo "expect-contract-red OK"
