# Task board

The live order is `poteto-mode/queue/backlog.md`. This table is the claim surface. An agent sets `In Progress` here in its own commit before doing the work.

| ID | Title | Status | Owner | Branch | PR |
| --- | --- | --- | --- | --- | --- |
| E1-02 | Dibujar diagramas Chen del núcleo clínico | Done | Carlos Hugo Escobar / Cursor | docs/e1-02-chen-nucleo | https://github.com/carloshugoeg/genki-health/pull/3 |
| E1-03 | Dibujar diagramas Chen de facturación, personal e insumos | Done | Carlos Hugo Escobar / Cursor | cursor/e1-03-chen-economico-1651 | https://github.com/carloshugoeg/genki-health/pull/8 |
| E1-04 | Dibujar el diagrama Chen de hospitalización | Done | Carlos Hugo Escobar / Cursor | docs/e1-04-chen-hospitalizacion | https://github.com/carloshugoeg/genki-health/pull/4 |
| E1-05 | Dibujar los diagramas Chen del centro pediátrico | Backlog | Jordin | | |
| E1-06 | Decisión humana sobre atributos en conflicto | Done | Carlos Hugo Escobar / Cursor | docs/e1-06-decision-humana | https://github.com/carloshugoeg/genki-health/pull/7 |
| E2-01 | Entrega II, aplicación cliente-servidor | In Progress | Carlos Hugo Escobar / Cursor | cursor/e2-01-app-scaffold-6295 | https://github.com/carloshugoeg/genki-health/pull/9 |
| E2-P0-01 | Adopt the E2 base and lift the stale E1-only gate | In Progress | agent / Auto (Cursor) | chore/T-E2-P0-01-repo-truth | |

E1-02 is Done (merged PR #3). E1-04 is Done (merged PR #4). E1-06 is Done (merged PR #7). E1-03 is Done (merged PR #8). E1-05 remains Jordin backlog for pediatric Chen diagrams and does not block E2. E2-01 scaffold lives on PR #9; this integration branch rebases that content onto main and lands E2-P0-01. Auth is locked (Carlos 2026-10-19). `NOW.md` points at E2-P0-01. Claimed 2026-11-06 by Auto (Cursor).
