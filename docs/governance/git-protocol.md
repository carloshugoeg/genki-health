# Git protocol

Canonical rules live in `AGENTS.md` and each ticket's setup block. This file is a short pointer.

- Do not push to `main`. Work on the ticket branch named in the ticket (Entrega I style `docs/<id>-<slug>`; E2 tickets follow their prompt).
- Commit order for executable E2 tickets: claim, then failing test commit, then implementation. Do not squash away red/green evidence locally.
- No force-push, amend, or rebase of shared history the ticket forbids. Never rewrite `cursor/e2-01-app-scaffold-6295` from later P0 work.
- Author commits as the human owner named in the run instructions. No `Co-authored-by` trailers unless the ticket says otherwise.
- Protocol-changing files need the `protocol-change` label and both owners' approval before merge. This pointer does not authorize merge.
