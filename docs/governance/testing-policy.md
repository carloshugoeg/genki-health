# Testing policy

Canonical gates live in `scripts/validate.sh`, `poteto-mode/definition-of-done.md`, and each ticket's **Tests first** block. This file is a short pointer.

- Write the named red tests before production or tracker behavior changes. Commit them alone as `test: <id> red contract`.
- Prefer behavior assertions over implementation details (`node:test` contracts for docs/trackers; Vitest for shared/server code).
- Never skip or weaken a required case to make an engine pass. A missing package is setup failure, not a behavioral red.
- After implementation, run the ticket's exact commands plus `bash scripts/validate.sh` (must end `validate.sh OK`). After P5-07 exists, behavioral PRs also run `VALIDATE_FULL=1`.
- Memory-adapter greens are not physical persistence evidence. Engine suites must use the physical service when the ticket says so.
