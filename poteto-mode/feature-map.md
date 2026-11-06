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

- **Now:** E1-03 (both, in review — facturación, personal e insumos) and E1-05 (Jordin/Claude, current in `NOW.md` — centro pediátrico). Do not rewrite the Graphviz shape key in the diagram README.
- **Next:** E2-01 (both) stays next until E1-03 and E1-05 merge. Do not split E2-01 until a human asks.
- **Blocked:** none for Entrega I attribute conflicts (E1-06 closed by Carlos, 2026-10-14).
- **Done:** Entrega I analysis already in the tree (no ticket): entities, attributes, classification, normalization, plain-language operations, overview ER, relational model. E1-02 Chen núcleo clínico (merged). E1-04 Chen hospitalización (merged). E1-06 human attribute decisions (merged PR #7).

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
| Chen: responsable y antecedente perinatal | now | Jordin/Claude | E1-05 |
| Chen: crecimiento | now | Jordin/Claude | E1-05 |
| Chen: vacunación | now | Jordin/Claude | E1-05 |
| Human decision on conflicting attributes (`PROFESIONAL`, `CAMA`, `MUNICIPIO`, evolution-note self-reference, `numero_colegiado`) | done | Carlos/Cursor | E1-06 |

## Entrega II

One ticket. These are the brief's expected results, not an implementation split. Laboratorio clínico and Clínica odontológica have no Entrega I ER diagram. Their document model is here.

| Capability | Status | Owner | Ticket |
| --- | --- | --- | --- |
| Client-server application | next | both | E2-01 |
| Database model corrected from Entrega I feedback | next | both | E2-01 |
| Queries equivalent on all four engines | next | both | E2-01 |
| Embed versus reference for MongoDB and Firebase | next | both | E2-01 |
| One interface, unchanged by the active engine | next | both | E2-01 |
| Create a record for a new patient | next | both | E2-01 |
| Maintain a record: consultation, diagnosis, treatment, prescription | next | both | E2-01 |
| Archive a record instead of deleting it | next | both | E2-01 |
| Route the session to the institution engine at login | next | both | E2-01 |
| Comparative note and written engine assignment | next | both | E2-01 |
