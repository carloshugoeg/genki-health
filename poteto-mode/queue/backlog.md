# Backlog

**Next:** E2-P2-07 — Expose patient search, detail, catalog and archive HTTP slices (ready, not claimed). E2-P3A-02 is also dependency-ready in parallel.



Order is the order a single agent follows when dependencies are satisfied. E1-05 runs in parallel for Jordin and does not block E2. After E2-P0-01 merged (PR #10), the Entrega II queue is the indexed E2-P* list below, not a single mega-ticket marked done because the scaffold landed.

| Order | Id | Title | Status | Owner | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | E1-02 | Dibujar diagramas Chen del núcleo clínico | done | Carlos / Cursor | none |
| 2 | E1-03 | Dibujar diagramas Chen de facturación, personal e insumos | done | Carlos / Cursor | E1-02 |
| 3 | E1-04 | Dibujar el diagrama Chen de hospitalización | done | Carlos | E1-02 |
| 4 | E1-05 | Dibujar los diagramas Chen del centro pediátrico | backlog | Jordin | E1-02 (parallel; not an E2 gate) |
| 5 | E1-06 | Decisión humana sobre atributos en conflicto | done | Carlos / Cursor | none |
| 6 | E2-01 | Entrega II scaffold (historical mega-ticket; see E2-P* index) | done (scaffold on main via #10) | Carlos / Cursor | E1-02, E1-06 |
| 7 | E2-P0-01 | Adopt the E2 base and lift the stale E1-only gate | done | agent | none |
| 8 | E2-P0-02 | Synchronize all baseline trackers and governance pointers | done | agent | E2-P0-01 |
| 9 | E2-P0-03 | Make the base CI reliable on main | done | agent | E2-P0-01 |
| 10 | E2-P1-01 | Commit the frozen API and port specification pack | done | agent | E2-P0-02 |
| 11 | E2-P1-02 | Commit the frozen SQL physical schema pack | done | agent | E2-P1-01 |
| 12 | E2-P1-03 | Commit document/security/seed contracts and mapping ADRs | done | agent | E2-P1-01 |
| 13 | E2-P1-04 | Install executable ticket prompts and gate checklist | done | agent | E2-P1-02, E2-P1-03 |
| 14 | E2-P2-01 | Add MVP DTOs, strict HTTP schemas and typed clinical errors | done | agent | E2-P1-01, E2-P1-04 |
| 15 | E2-P2-02 | Freeze one adapter contract suite including native rollback failures | done | agent | E2-P2-01 |
| 16 | E2-P2-03 | Give memory real isolated transactions and stable registry instances | done | agent | E2-P2-02 |
| 17 | E2-P2-04 | Complete memory patient registration, guardians, search and archive | done | agent | E2-P2-03 |
| 18 | E2-P2-05 | Implement pure consultation bundle invariants | done | agent | E2-P2-01 |
| 19 | E2-P2-06 | Implement memory closed consultation aggregate and turn contract suite green | done | agent | E2-P2-04, E2-P2-05 |
| 20 | E2-P2-07 | Expose patient search, detail, catalog and archive HTTP slices | backlog | agent | E2-P2-06, E2-P2-01 |
| 21 | E2-P2-08 | Wire atomic consultation use case and HTTP save | backlog | agent | E2-P2-06, E2-P2-07 |
| 22 | E2-P2-09 | Extract storage-neutral JWT service with persistent-session port | done | agent | E2-P2-01 |
| 23 | E2-P2-10 | Close the core memory gate with coverage and API isolation tests | backlog | agent | E2-P2-09, E2-P2-08 |
| 24 | E2-P3A-01 | Provision deterministic local engines and safe bootstrap commands | done | agent | E2-P1-03, E2-P2-02 |
| 25 | E2-P3A-02 | Create PostgreSQL migrations, type mapping and scoped transaction wrapper | backlog | agent | E2-P3A-01, E2-P1-02, E2-P2-06 |
| 26 | E2-P3A-03 | Implement PostgreSQL patient registration, read/search and archive | backlog | agent | E2-P3A-02 |
| 27 | E2-P3A-04 | Implement PostgreSQL atomic consultation bundle and pass shared suite | backlog | agent | E2-P3A-03 |
| 28 | E2-P3A-05 | Persist all four institutions identities and refresh sessions in Hospital PG | backlog | agent | E2-P3A-02, E2-P2-09 |
| 29 | E2-P3A-06 | Enforce and prove PostgreSQL least-privilege roles | backlog | agent | E2-P3A-04, E2-P3A-05 |
| 30 | E2-P3B-01 | Create MySQL InnoDB schema and transaction/type mapping | backlog | agent | E2-P3A-01, E2-P1-02, E2-P2-06 |
| 31 | E2-P3B-02 | Implement MySQL pediatric registration, guardians and patient queries | backlog | agent | E2-P3B-01 |
| 32 | E2-P3B-03 | Implement MySQL consultation bundle and shared contract runner | backlog | agent | E2-P3B-02 |
| 33 | E2-P3B-04 | Enforce and prove MySQL app/report roles | backlog | agent | E2-P3B-03 |
| 34 | E2-P4A-01 | Create Mongo validators/indexes and real replica-set transactions | backlog | agent | E2-P3A-01, E2-P1-03, E2-P2-06 |
| 35 | E2-P4A-02 | Implement Mongo patient/expediente/guardian transactions and search | backlog | agent | E2-P4A-01 |
| 36 | E2-P4A-03 | Implement Mongo bounded embedded consultations and full contract runner | backlog | agent | E2-P4A-02 |
| 37 | E2-P4A-04 | Enforce and prove Mongo app/report permissions | backlog | agent | E2-P4A-03 |
| 38 | E2-P4B-01 | Pin Firestore emulator, collection indexes and tested deny-by-default rules | backlog | agent | E2-P1-03, E2-P3A-01 |
| 39 | E2-P4B-02 | Implement Firestore buffered read-before-write UoW and integer mapping | backlog | agent | E2-P4B-01, E2-P2-06 |
| 40 | E2-P4B-03 | Implement Firestore registration, uniqueness reservation, search and archive | backlog | agent | E2-P4B-02 |
| 41 | E2-P4B-04 | Implement Firestore bounded consultation aggregate and shared runner | backlog | agent | E2-P4B-03 |
| 42 | E2-P4B-05 | Prove Firestore backend isolation separately from rules | backlog | agent | E2-P4B-04 |
| 43 | E2-P5-01 | Create idempotent fake seeds for four institutions and identity | backlog | agent | E2-P3A-04, E2-P3A-05, E2-P3B-03, E2-P4A-03, E2-P4B-04 |
| 44 | E2-P5-02 | Wire real engine composition and fail-fast startup | backlog | agent | E2-P3A-06, E2-P3B-04, E2-P4A-04, E2-P4B-05, E2-P2-10 |
| 45 | E2-P5-03 | Build engine-agnostic login, patient search and registration screens | backlog | agent | E2-P2-10, E2-P1-04 |
| 46 | E2-P5-04 | Build complete history, consultation composer and archive confirmation UI | backlog | agent | E2-P5-03, E2-P2-08 |
| 47 | E2-P5-05 | Create one Playwright core smoke run for each institution | backlog | agent | E2-P5-01, E2-P5-02, E2-P5-04 |
| 48 | E2-P5-06 | Prove persisted writes and restart survival in the correct physical store | backlog | agent | E2-P5-05 |
| 49 | E2-P5-07 | Make full CI contract matrix, coverage, security and e2e required gates | backlog | agent | E2-P5-06, E2-P0-03 |
| 50 | E2-P6-01 | Assemble the Spanish comparative note from verified ADRs | backlog | agent | E2-P5-06, E2-P1-03 |
| 51 | E2-P6-02 | Package comparative PDF and rehearse the reproducible demo | backlog | agent | E2-P6-01, E2-P5-07 |
| 52 | E2-P6-03 | Close Entrega II trackers against evidence without erasing deferred work | backlog | agent | E2-P6-02, E2-P0-02 |

Ticket bodies are in `tickets/` when created. This file is the queue index. Full titles match the E2-P0-02 tracker input table.

GitHub Project and GitHub issues were not created. `gh` is logged in as `cursor[bot]` and cannot act on `carloshugoeg/genki-health` beyond what the integration allows. There is no project URL. Do not invent issue numbers.
