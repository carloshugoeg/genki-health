# Handoff

A ticket is handed off only through the queue. Chat is not the queue.

## Claim

Edit `docs/progress/TASKS.md`. Set the ticket to `In Progress`, with owner and date. Commit that edit alone, before the work.

## Finish

1. Acceptance criteria in the ticket are true in the tree, not only described.
2. `docs/progress/journal/YYYY-MM-DD-<ticket-id>.md` says what changed, which decision was already locked, and what the next ticket is.
3. `docs/progress/TASKS.md` sets the ticket to `Done` only in the PR that should merge. Until merge, leave it `In Progress`.
4. Move `queue/NOW.md` to the next ticket in `queue/backlog.md` that is not `needs-human` and whose dependencies are done or in review. Leave the finished ticket in the backlog with status `in review`.
5. Open the PR with the template. Link the ticket id.

## Blocked

If the work needs a design choice that is not in `decisions/locked.md`, add the question to `decisions/needs-human.md`, set the ticket to `Blocked` in `TASKS.md`, and stop. Do not pick the next ticket in the same session to "stay busy" unless `NOW.md` was this blocked ticket and the backlog has another unblocked ticket. In that case, point `NOW.md` at the unblocked ticket and stop after the blocker note. The next session starts clean.

## Dependencies

A ticket with `Depends on` does not start until those tickets are merged. Parallel work is allowed only when the backlog says so, and only on tickets that do not edit the same files.
