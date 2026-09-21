# poteto-mode

This directory is how an agent operates in this repository.

No file in the repo and no section of the Entrega I PDF defines a `/poteto-mode` tree. The name `poteto-mode` in Cursor is a writing style, not a layout. This tree is the concrete operating system assumed for Genki Health. Roles, handoff, ticket format, definition of done, and the next-up queue all live here.

## Boot

1. `AGENTS.md`
2. `queue/NOW.md`
3. `decisions/locked.md` and `decisions/needs-human.md`
4. The ticket file linked from `NOW.md`

Then claim, branch, and build that ticket. The handoff is `handoff.md`. The exit check is `definition-of-done.md`.

## Map

| Path | Role |
| --- | --- |
| `roles.md` | Who decides, who codes, which institution |
| `handoff.md` | How a finished ticket is passed on |
| `ticket-format.md` | Required fields on every ticket |
| `definition-of-done.md` | When a ticket is actually done |
| `decisions/locked.md` | Do not reopen these |
| `decisions/needs-human.md` | Stop. Do not guess. |
| `queue/NOW.md` | The one ticket in progress or next |
| `queue/backlog.md` | Ordered list after NOW |
| `queue/tickets/` | Full ticket bodies |

GitHub issues, when they exist, are mirrors of `queue/tickets/`. If the issue and the file disagree, the file in this directory is the one the agent executes, and the PR must update the issue to match.
