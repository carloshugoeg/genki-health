#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> expect-contract-red: build shared"
npm run build -w @genki/shared

echo "==> expect-contract-red: CONTRACT_RED=1 memory contract suite"
set +e
CONTRACT_RED=1 npm test -w @genki/server -- test/contracts/memory.test.ts
code=$?
set -e

if [[ "$code" -eq 0 ]]; then
  echo "expect-contract-red: suite passed unexpectedly"
  echo "Retire this gate in P2-06 after CONTRACT_READY=1 is the default."
  exit 1
fi

echo "expect-contract-red: suite exited ${code} (expected non-zero until P2-06)"
echo "expect-contract-red OK"
exit 0
