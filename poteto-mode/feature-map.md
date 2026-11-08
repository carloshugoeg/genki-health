# Feature map

Capabilities for Entrega I (Chen diagrams) through Entrega II. This is not a second backlog. The queue stays `queue/NOW.md` and `queue/backlog.md`. Ticket bodies stay in `queue/tickets/`.

Update this file in the same change as the work. Set every row with that ticket id, and keep the rollup in sync. Map status is only `now`, `next`, `blocked`, or `done`:

| Ticket status | Map status |
| --- | --- |
| `now`, `in progress`, `in review` | `now` |
| `backlog` | `next` |
| `blocked`, or `Needs human: yes` | `blocked` |
| `done` | `done` |

Rows that share a ticket share a status. Owner is `Carlos/Cursor`, `Jordin/Claude`, or `both`.

## Rollup

- **Now:** E2-P3A-01 local engines + safe bootstrap (claimed on `cursor/e2-p3a-01-provision-55f2`). E2-01 scaffold + Auth are on `main` via merged PR #10. E1-03 is Done (merged PR #8). Do not rewrite the Graphviz shape key.
- **Next:** E2-P2-07 / E2-P2-09 when an owner claims them (parallel agent lane). E1-05 (Jordin/Claude) pediatric Chen diagrams (parallel, not an E2 gate). Remaining E2 capabilities stay indexed as later P2–P6 tickets; scaffold landing did not mark them done.
- **Blocked:** Multitenant permission *grants* beyond institution routing stay stop-and-ask if raised.
- **Done:** Entrega I analysis in tree. E1-02 Chen núcleo. E1-03 Chen facturación/personal/insumos (merged PR #8). E1-04 Chen hospitalización. E1-06 attribute decisions locked and merged. Auth decisions locked. E2-P0-01 repo truth / E1-only gate lift (merged PR #10). E2-P0-02 tracker and governance sync (PR #11). E2-P0-03 base CI / journal gate (PR #12). E2-P1-01 frozen API/port pack (merged PR #13). E2-P1-02 frozen SQL physical schema pack (merged PR #14). E2-P1-03 document/security/seed contracts and mapping ADRs (merged PR #15). E2-P1-04 executable ticket prompts and gate checklist (merged PR #16). E2-P2-01 MVP DTOs / strict HTTP schemas / typed clinical errors (PR #17). E2-P2-02 adapter contract suite C3.4 freeze (PR #18). E2-P2-03 memory isolated transactions / stable registry (PR #21). E2-P2-04 memory patient registration, guardians, search, and archive (PR #22 base). E2-P2-05 pure consultation bundle invariants (PR #19, integrated unchanged). E2-P2-06 memory closed consultation aggregate and C3.4 suite green (this branch).

## Entrega I

Analysis below is already in `docs/entregas/entrega-1/`. It has no ticket. The open work is the sección 6.4 Chen diagrams and the human decision.

| Capability | Status | Owner | Ticket |
| --- | --- | --- | --- |
| Entities identified, all four institutions | done | both | — |
| Attributes per entity | done | both | — |
| Public, confidential, and restricted data | done | both | — |
| Normalized relational models | done | both | — |
| Plain-language operations | done | both | — |
| ER overview, Hospital general and Centro médico pediátrico | done | both | — |
| Relational model, secciones 7.4 and 7.5 | done | both | — |
| Chen: paciente, expediente, contacto de emergencia | done | both | E1-02 |
| Chen: agenda, consulta, signos vitales | done | both | E1-02 |
| Chen: diagnóstico, tratamiento, receta | done | both | E1-02 |
| Chen: acceso, roles, auditoría | done | both | E1-02 |
| Chen: facturación | done | both | E1-03 |
| Chen: personal y honorarios | done | both | E1-03 |
| Chen: insumos y cargos | done | both | E1-03 |
| Chen: hospitalización (Hospital general) | done | Carlos/Cursor | E1-04 |
| Chen: responsable y antecedente perinatal | next | Jordin/Claude | E1-05 |
| Chen: crecimiento | next | Jordin/Claude | E1-05 |
| Chen: vacunación | next | Jordin/Claude | E1-05 |
| Human decision on conflicting attributes (`PROFESIONAL`, `CAMA`, `MUNICIPIO`, evolution-note self-reference, `numero_colegiado`) | done | Carlos/Cursor | E1-06 |

## Entrega II

Phase-0 scaffold is on `main`. Real engine adapters remain incomplete. Capability rows point at the indexed E2-P* tickets in `queue/backlog.md` and `docs/plan/E2-EXECUTABLE.md`, not at a single mega-ticket marked done.

| Capability | Status | Owner | Ticket |
| --- | --- | --- | --- |
| Adopt E2 base; lift stale E1-only gate | done | agent/Auto | E2-P0-01 |
| Synchronize baseline trackers and governance pointers | done | agent/Auto | E2-P0-02 |
| Make the base CI reliable on main | done | agent/Auto | E2-P0-03 |
| Frozen API and port specification pack | done | agent/Auto | E2-P1-01 |
| Frozen SQL physical schema pack (C4a/C4b) | done | agent/Auto | E2-P1-02 |
| Document/security/seed contracts and mapping ADRs (C5) | done | agent/Auto | E2-P1-03 |
| Executable ticket prompts, path registry, and gate checklist index | done | agent/Auto | E2-P1-04 |
| MVP DTOs, strict HTTP schemas, typed clinical errors | done | agent/Auto | E2-P2-01 |
| Adapter contract suite (C3.4) including native rollback failures | done | agent/Auto | E2-P2-02 |
| Memory isolated transactions and stable registry instances | done | agent/Auto | E2-P2-03 |
| Client-server application (scaffold on main; adapters incomplete) | next | Carlos/Cursor | E2-01 / E2-P2+ |
| Database model corrected from Entrega I feedback | done | both | E2-P1-02 / E2-P1-03 |
| Queries equivalent on all four engines | next | both | E2-P3A–E2-P4B / E2-P5 |
| Embed versus reference for MongoDB and Firebase | next | both | E2-P1-03 / E2-P4A / E2-P4B |
| One interface, unchanged by the active engine | next | Carlos/Cursor | E2-P2 / E2-P5-03 |
| Create a record for a new patient | next | Carlos/Cursor | E2-P2-04 / E2-P2-07 |
| Maintain a record: consultation, diagnosis, treatment, prescription | next | both | E2-P2-05 / E2-P2-06 / E2-P2-08 |
| Archive a record instead of deleting it | next | Carlos/Cursor | E2-P2-04 / E2-P2-07 |
| Route the session to the institution engine at login | next | Carlos/Cursor | E2-P2-09 / E2-P5-02 |
| Comparative note and written engine assignment | next | both | E2-P6-01 / E2-P6-02 |
