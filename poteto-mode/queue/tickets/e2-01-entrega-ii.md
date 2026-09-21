# E2-01 Entrega II, aplicación cliente-servidor

- Status: backlog
- Owner: either
- Agent: either
- Depends on: E1-02, E1-03, E1-04, E1-05, E1-06
- Needs human: no

## What to build

Do not build this yet. When every Entrega I ticket is merged and E1-06 is decided, the next agent splits this ticket. Until then it only records what the brief already requires.

The brief, in `PROJECT-DESC.md` under Entrega II, asks for a client-server application. The client consults and administers a clinical record. The server persists to the engine of the signed-in user's institution. Hexagonal architecture is the shared starting point. The same business rules run on different data models. Register a consultation, add a diagnosis, prescribe a medication.

## Acceptance criteria

These are the brief's expected results, not a design.

- A working application and a client-server connection.
- The database model corrected from Entrega I feedback.
- Queries that behave the same on all four engines.
- An explicit embed-versus-reference decision for MongoDB and Firebase.
- One interface, unchanged by the active engine.
- Create a record for a new patient.
- Maintain an existing record with new consultations, diagnoses, treatments, and prescriptions.
- Archive a record instead of deleting it.
- Routing by user. Login selects the institution engine without rewriting business logic.
- A short comparative note per engine covering modeling, consistency, and security, plus the written reason for the institution-to-engine assignment.

## Out of scope

- Starting this work while an Entrega I ticket is open.
- Hosting, an ORM, GraphQL, or a second product.

## Links

- `PROJECT-DESC.md` sección Entrega II
- `docs/roadmap/ROADMAP.md`
- `docs/superpowers/specs/2026-08-27-genki-health-architecture-and-agent-governance-design.md` for the already approved stack, when a human asks to split this ticket
