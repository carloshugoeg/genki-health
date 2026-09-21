# Backlog

Order is the order a single agent follows. After E1-02 merges, E1-04 and E1-05 may run in parallel because they do not touch the same files. E1-03 may run in parallel with them only if it does not edit the shape key that E1-02 added.

| Order | Id | Title | Status | Owner | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | E1-02 | Dibujar diagramas Chen del núcleo clínico | now | either | none |
| 2 | E1-03 | Dibujar diagramas Chen de facturación, personal e insumos | backlog | either | E1-02 |
| 3 | E1-04 | Dibujar el diagrama Chen de hospitalización | backlog | Carlos | E1-02 |
| 4 | E1-05 | Dibujar los diagramas Chen del centro pediátrico | backlog | Jordin | E1-02 |
| 5 | E1-06 | Decisión humana sobre atributos en conflicto | blocked | either | none |
| 6 | E2-01 | Entrega II, aplicación cliente-servidor | future | either | E1-02, E1-03, E1-04, E1-05, E1-06 |

Ticket bodies are in `tickets/`. GitHub issue numbers are filled in after the project exists. If the project is missing, this file is the queue.
