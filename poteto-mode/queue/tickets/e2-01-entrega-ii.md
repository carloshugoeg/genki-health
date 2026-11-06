# E2-01 Entrega II, aplicación cliente-servidor

- Status: in progress
- Owner: Carlos Hugo Escobar / Cursor
- Agent: Cursor
- Depends on: E1-02, E1-06 (merged); E1-03 and E1-05 may remain open for Chen diagrams only
- Needs human: partial (Auth — see `decisions/needs-human.md`)

## What to build

Carlos ordered Entrega II scaffolding on 2026-10-19 (overrides the prior “do not build yet” gate). Follow the approved architecture at `docs/superpowers/specs/2026-08-27-genki-health-architecture-and-agent-governance-design.md`. Do not invent clinical entities. Stop Auth / payments / migrations / multitenant permission grants / deletes / protocol changes for human decision.

## Phase-0 slice (this PR)

- npm workspaces: `server/`, `web/`, `shared/`
- Hexagonal folders + placeholder engine adapter dirs
- Shared DTO types from Entrega I `rel-*.mmd`
- Ports including fail-closed `AuthPort`
- Memory adapter + register-paciente / archive rules
- Institution → adapter registry (memory for all four)
- `infra/docker-compose.yml`, Firebase emulator stub, `.env.example`
- `scripts/validate.sh` + CI workflow

## Acceptance criteria (brief — full Entrega II)

These remain the course expected results. Phase-0 does not claim them all done.

- [ ] A working application and a client-server connection.
- [ ] The database model corrected from Entrega I feedback.
- [ ] Queries that behave the same on all four engines.
- [ ] An explicit embed-versus-reference decision for MongoDB and Firebase.
- [ ] One interface, unchanged by the active engine.
- [ ] Create a record for a new patient.
- [ ] Maintain an existing record with new consultations, diagnoses, treatments, and prescriptions.
- [ ] Archive a record instead of deleting it.
- [ ] Routing by user. Login selects the institution engine without rewriting business logic.
- [ ] A short comparative note per engine covering modeling, consistency, and security, plus the written reason for the institution-to-engine assignment.

## Out of scope (still)

- Hosting, an ORM, GraphQL, or a second product.
- Inventing Auth policy.
- Jordin’s pediatric Chen diagrams (E1-05) and MySQL/Firebase adapter implementations.

## Links

- `PROJECT-DESC.md` sección Entrega II
- `docs/roadmap/ROADMAP.md`
- Architecture spec (stack locked)
