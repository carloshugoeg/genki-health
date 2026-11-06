# Task board

The live order is `poteto-mode/queue/backlog.md`. This table is the claim surface. An agent sets `In Progress` here in its own commit before doing the work.

| ID | Title | Status | Owner | Branch | PR |
| --- | --- | --- | --- | --- | --- |
| E1-02 | Dibujar diagramas Chen del núcleo clínico | Done | Carlos Hugo Escobar / Cursor | docs/e1-02-chen-nucleo | https://github.com/carloshugoeg/genki-health/pull/3 |
| E1-03 | Dibujar diagramas Chen de facturación, personal e insumos | Done | Carlos Hugo Escobar / Cursor | cursor/e1-03-chen-economico-1651 | https://github.com/carloshugoeg/genki-health/pull/8 |
| E1-04 | Dibujar el diagrama Chen de hospitalización | Done | Carlos Hugo Escobar / Cursor | docs/e1-04-chen-hospitalizacion | https://github.com/carloshugoeg/genki-health/pull/4 |
| E1-05 | Dibujar los diagramas Chen del centro pediátrico | Backlog | Jordin | | |
| E1-06 | Decisión humana sobre atributos en conflicto | Done | Carlos Hugo Escobar / Cursor | docs/e1-06-decision-humana | https://github.com/carloshugoeg/genki-health/pull/7 |
| E2-01 | Entrega II scaffold (historical; rollup → E2-P*) | Done (scaffold on main) | Carlos Hugo Escobar / Cursor | cursor/e2-01-app-scaffold-6295 | https://github.com/carloshugoeg/genki-health/pull/9 |
| E2-P0-01 | Adopt the E2 base and lift the stale E1-only gate | Done | agent / Auto (Cursor) | chore/T-E2-P0-01-repo-truth | https://github.com/carloshugoeg/genki-health/pull/10 |
| E2-P0-02 | Synchronize all baseline trackers and governance pointers | Done | agent / Auto (Cursor) | docs/T-E2-P0-02-synchronize | https://github.com/carloshugoeg/genki-health/pull/11 |
| E2-P0-03 | Make the base CI reliable on main | Done | Auto (Cursor) / Hugo Escobar | docs/T-E2-P0-03-make | https://github.com/carloshugoeg/genki-health/pull/12 |
| E2-P1-01 | Commit the frozen API and port specification pack | Done | Auto (Cursor) / Hugo Escobar | docs/T-E2-P1-01-commit | https://github.com/carloshugoeg/genki-health/pull/13 |
| E2-P1-02 | Commit the frozen SQL physical schema pack | In Progress | Auto (Cursor) / Hugo Escobar | docs/T-E2-P1-02-commit | |

E1-02–E1-04 and E1-06 are Done. E1-03 is Done (merged PR #8). E1-05 remains Jordin backlog, runs in parallel, and does not block E2. E2-P0-01 is Done (merged PR #10). E2-P0-02 is Done on `docs/T-E2-P0-02-synchronize` (PR #11). E2-P0-03 is Done on `docs/T-E2-P0-03-make` (PR #12). E2-P1-01 is Done on `docs/T-E2-P1-01-commit`. E2-P1-02 is In Progress on `docs/T-E2-P1-02-commit`. Remaining E2-P1…E2-P6 rows live in `poteto-mode/queue/backlog.md`. Auth is locked (Carlos 2026-10-19).
