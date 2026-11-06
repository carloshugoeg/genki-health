# Workflow

Canonical agent loop lives in `AGENTS.md` (session loop) and `poteto-mode/`. This file is a short pointer, not a second process.

1. Read `AGENTS.md`, `poteto-mode/queue/NOW.md`, `poteto-mode/decisions/locked.md`, and `poteto-mode/decisions/needs-human.md`.
2. Claim the single ready ticket in `NOW.md`. Set it In Progress in `docs/progress/TASKS.md` and commit `chore: claim <id>` before other work.
3. Red-first tests for named cases, then implement until those tests and `bash scripts/validate.sh` are green.
4. Journal under `docs/progress/journal/`, update feature-map / NOW / ticket status in the same change, open a PR. Do not merge protocol-change PRs without both owners.

Cross-validation uses the same commands as the ticket acceptance block. Do not invent a parallel checklist here. Gate evidence goes in `docs/gate-checklist.md` only for gates the ticket reaches.
