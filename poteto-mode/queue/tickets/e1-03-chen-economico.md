# E1-03 Dibujar diagramas Chen de facturación, personal e insumos

- Status: backlog
- Owner: either
- Agent: either
- Depends on: E1-02
- Needs human: no

## What to build

Chen sources and PNG renders, same notation as E1-02.

- `docs/entregas/entrega-1/diagramas/chen-6.4.9-facturacion.dot`
- `docs/entregas/entrega-1/diagramas/chen-6.4.10-personal-honorarios.dot`
- `docs/entregas/entrega-1/diagramas/chen-6.4.11-insumos-cargos.dot`

List them in the diagram README.

## Acceptance criteria

- 6.4.9 shows `total`, `subtotal_linea`, and `saldo_pendiente` as derived attributes. `DETALLE_FACTURA` and `PAGO` are weak entities of `FACTURA`. Each line comes from one `CARGO`, and a charge is billed at most once.
- 6.4.10 shows `TARIFA_HONORARIO` as a relationship between professional and billable service, with its own attributes, including a validity start. `PARTICIPACION` records who acted in which clinical role. `honorario_calculado` is derived.
- 6.4.11 shows `CARGO` with five optional origin foreign keys and the rule that at most one is set. `INSUMO` stays distinct from `MEDICAMENTO`.
- Attributes come from sección 5. Do not add columns that exist only to paper over `needs-human.md`.
- `dot -Tpng` exits 0.

## Out of scope

- Hospitalización and the pediatric extensions.
- Physical SQL types. Supuesto 15.

## Links

- Secciones 6.4.9, 6.4.10, 6.4.11, 5.1, and 6.5 of the transcription
- `poteto-mode/queue/tickets/e1-02-chen-nucleo.md` for the shape key
