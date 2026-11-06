# Definition of done

A ticket is done when every acceptance criterion is true and the handoff steps are done.

## Entrega I diagram tickets

For an Entrega I diagram ticket, all of these are required.

- The new source file is in `docs/entregas/entrega-1/diagramas/`.
- It uses the symbols from sección 6.1. Strong entity, weak entity, relationship, identifying relationship, key attribute, partial key, multivalued attribute, derived attribute, composite attribute, partial participation, total participation, cardinality.
- Every entity and attribute on the diagram is already in sección 4 or sección 5. Nothing new.
- Relationship names match the names in the section the ticket cites.
- `dot -Tpng` succeeds when Graphviz is installed, and the PNG is committed next to the source.
- The diagram README lists the new files.
- A journal file exists for the session.
- No application code, no SQL migrations, no new entity.

## Entrega II tickets

For an Entrega II ticket, all of these are required.

- Acceptance criteria named in the ticket pass. Required test case names are green. Tests were not weakened or skipped.
- Claim commit, then failing test commit, then implementation commit, in that order (inspect `git log --reverse --format=%s origin/main..HEAD`).
- `bash scripts/validate.sh` ends with `validate.sh OK` for the change set. After P5-07 exists, behavioral PRs also run `VALIDATE_FULL=1 bash scripts/validate.sh`.
- Frozen contracts under `docs/plan/contracts/` are unchanged unless the ticket explicitly owns them.
- Initial ports, schema, and CI changes ship only as protocol-change PRs reviewed by both owners. No ORM. No real Firebase project on the critical path.
- Clinical rows are never deleted; archive only.
- Auth locks in `poteto-mode/decisions/locked.md` stay intact unless Carlos reopens them.
- Gate evidence in `docs/gate-checklist.md` is updated only for gates this ticket reaches. No predicted passes.
- A unique journal exists for the session. Ticket status ends `done` / `hecho` in the same PR.
- Spanish professor-facing section names are unchanged where the ticket touches them.

## Every ticket

- Spanish section names are unchanged.
- Locked decisions are untouched.
- `needs-human` product decisions are untouched (execution assumptions may be appended when a ticket says so).
- The PR description names the ticket id and the next ticket.
- The matching rows and the rollup in `feature-map.md` match this ticket, and `queue/NOW.md` is the current ticket.
