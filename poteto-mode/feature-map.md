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

- **Now:** E2-01 (Carlos/Cursor) app scaffold + Auth (login/JWT routing) in progress on PR #9. E1-03 (both) may still be open as Chen PR #8 in parallel. Do not rewrite the Graphviz shape key.
- **Next:** E1-05 (Jordin/Claude) pediatric Chen diagrams. Remaining E2-01 capabilities (engine adapters, consultations, comparative note).
- **Blocked:** none for Auth (Carlos locked 2026-10-19). Multitenant permission *grants* beyond institution routing stay stop-and-ask if raised.
- **Done:** Entrega I analysis in tree. E1-02 Chen núcleo. E1-04 Chen hospitalización. E1-06 attribute decisions locked and merged. Auth decisions locked.

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
| Chen: facturación | now | both | E1-03 |
| Chen: personal y honorarios | now | both | E1-03 |
| Chen: insumos y cargos | now | both | E1-03 |
| Chen: hospitalización (Hospital general) | done | Carlos/Cursor | E1-04 |
| Chen: responsable y antecedente perinatal | next | Jordin/Claude | E1-05 |
| Chen: crecimiento | next | Jordin/Claude | E1-05 |
| Chen: vacunación | next | Jordin/Claude | E1-05 |
| Human decision on conflicting attributes (`PROFESIONAL`, `CAMA`, `MUNICIPIO`, evolution-note self-reference, `numero_colegiado`) | done | Carlos/Cursor | E1-06 |

## Entrega II

One ticket. Phase-0 scaffold started under Carlos’s order (2026-10-19). Laboratorio clínico and Clínica odontológica document models remain later slices.

| Capability | Status | Owner | Ticket |
| --- | --- | --- | --- |
| Client-server application | now | Carlos/Cursor | E2-01 |
| Database model corrected from Entrega I feedback | next | both | E2-01 |
| Queries equivalent on all four engines | next | both | E2-01 |
| Embed versus reference for MongoDB and Firebase | next | both | E2-01 |
| One interface, unchanged by the active engine | now | Carlos/Cursor | E2-01 |
| Create a record for a new patient | now | Carlos/Cursor | E2-01 |
| Maintain a record: consultation, diagnosis, treatment, prescription | next | both | E2-01 |
| Archive a record instead of deleting it | now | Carlos/Cursor | E2-01 |
| Route the session to the institution engine at login | now | Carlos/Cursor | E2-01 |
| Comparative note and written engine assignment | next | both | E2-01 |
