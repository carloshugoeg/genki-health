# Ticket format

Every file in `queue/tickets/` uses these headings, in this order.

```
# <id> <title>

- Status: backlog | now | in progress | blocked | in review | done
- Owner: Carlos | Jordin | either
- Agent: Cursor | Claude | either
- Depends on: ticket ids, or none
- Needs human: yes | no

## What to build

## Acceptance criteria

## Out of scope

## Links
```

`What to build` names the files to add or change. `Acceptance criteria` are checks a later agent can run without asking. `Out of scope` repeats the nearest temptation to widen the task. `Links` points at the Spanish section names in `docs/entregas/entrega-1/analisis-y-modelo-relacional.md` and at the PDF.

GitHub issue titles use the same id prefix, for example `E1-02 Dibujar diagramas Chen del núcleo clínico`.
