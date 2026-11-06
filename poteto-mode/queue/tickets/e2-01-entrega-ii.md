# E2-01 Entrega II, aplicación cliente-servidor (historical scaffold)

- Status: done (scaffold on main via PR #10); Estado: hecho (scaffold). Remaining Entrega II work is the indexed E2-P* rollup, not this mega-ticket.
- Owner: Carlos Hugo Escobar / Cursor
- Agent: Cursor
- Depends on: E1-02, E1-06 (merged); E1-03 done (#8); E1-05 parallel Chen only (not an E2 gate)
- Needs human: Auth locked (Carlos 2026-10-19). See `decisions/locked.md`.

## What this ticket was

Carlos ordered Entrega II scaffolding on 2026-10-19. Phase-0 delivered npm workspaces, hexagonal folders, memory adapter, Auth behind `AuthPort`, validate.sh, and CI. That scaffold is on `main` through E2-P0-01 (PR #10).

## Acceptance (rollup, not all done)

Do not treat the original Entrega II expected-results checklist as complete because the scaffold landed. Track remaining work through:

- `docs/plan/E2-EXECUTABLE.md` (index)
- `docs/plan/contracts/CORE.md` (C1 live scope)
- `poteto-mode/queue/backlog.md` (E2-P0…E2-P6)
- `poteto-mode/feature-map.md` (capability → ticket mapping)

Course expected results (still open across later tickets): working app on four engines, corrected model, equivalent queries, embed-vs-reference, engine-agnostic UI, patient create/maintain/archive, institution routing, comparative note.

## Out of scope (still)

- Hosting, an ORM, GraphQL, or a second product.
- Reopening Auth locks.
- Jordin’s pediatric Chen diagrams (E1-05) and unfinished MySQL/Firebase physical adapters.

## Links

- `PROJECT-DESC.md` sección Entrega II
- `docs/roadmap/ROADMAP.md`
- Architecture spec (stack locked)
- Successor index starts at E2-P0-03 / E2-P1-01 after E2-P0-02
