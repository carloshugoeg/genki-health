# Backlog

Order is the order a single agent follows. After E1-02 merges, E1-04 and E1-05 may run in parallel because they do not touch the same files. E1-03 may run in parallel with them only if it does not edit the shape key that E1-02 added.

| Order | Id | Title | Status | Owner | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | E1-02 | Dibujar diagramas Chen del núcleo clínico | done | Carlos / Cursor | none |
| 2 | E1-03 | Dibujar diagramas Chen de facturación, personal e insumos | now | either | E1-02 |
| 3 | E1-04 | Dibujar el diagrama Chen de hospitalización | done | Carlos | E1-02 |
| 4 | E1-05 | Dibujar los diagramas Chen del centro pediátrico | backlog | Jordin | E1-02 |
| 5 | E1-06 | Decisión humana sobre atributos en conflicto | in review | Carlos / Cursor | none |
| 6 | E2-01 | Entrega II, aplicación cliente-servidor | future | either | E1-02, E1-03, E1-04, E1-05, E1-06 |

Ticket bodies are in `tickets/`. This file is the queue.

GitHub Project and GitHub issues were not created. `gh` is logged in as `cursor[bot]` and cannot act on `carloshugoeg/genki-health` beyond what the integration allows.

- `gh project create --owner carloshugoeg --title "Genki Health — Entrega I"` returned `GraphQL: cursor[bot] does not have permission to create projects on ownerId U_kgDOCW-VIw. (createProjectV2)`.
- `gh issue create` returned `GraphQL: Resource not accessible by integration (createIssue)` for every ticket.
- `gh api user` returned HTTP 403 `Resource not accessible by integration`.
- `gh api repos/carloshugoeg/genki-health` reported `admin`, `maintain`, `pull`, `push`, and `triage` as false.

There is no project URL. Do not invent issue numbers. When a human token with `project` and `repo` scope is available, create the project and one issue per file in `tickets/`, in the order above, and write the numbers back into this table.
