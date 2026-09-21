# E1-04 Dibujar el diagrama Chen de hospitalización

- Status: backlog
- Owner: Carlos
- Agent: Cursor
- Depends on: E1-02
- Needs human: no

## What to build

- `docs/entregas/entrega-1/diagramas/chen-6.4.4-hospitalizacion.dot`
- The PNG from `dot -Tpng`
- An entry in the diagram README

## Acceptance criteria

- Covers sección 6.4.4 for Hospital general.
- `CAMA` is a weak entity of `SERVICIO`. Partial key `codigo`, unique only inside the service.
- `NOTA_EVOLUCION` is a weak entity of `ADMISION`.
- The diagram states that evolution notes are append-only. It does not add a self-reference column. That column is item 4 in `needs-human.md`.
- `PROCEDIMIENTO` hangs from an admission or a consultation, and the diagram does not force both.
- Attributes match sección 5.2. `tipo_cama` and `codigo_servicio` are in sección 5.2, so they belong on this Chen diagram even though sección 7.4 omitted them. Do not copy them back into `rel-hospitalizacion.mmd`.
- `dot -Tpng` exits 0.

## Out of scope

- Pediatric diagrams.
- Resolving the sección 5 versus sección 7.4 gap for `CAMA`.

## Links

- Sección 6.4.4 and sección 5.2 of the transcription
- `poteto-mode/decisions/needs-human.md`
