# ADR-0005 — Security classification, principals, and seed boundary

- Status: Accepted
- Date: 2026-11-06
- Contract: Frozen C5.3–C5.5 (`docs/plan/contracts/DOCUMENTS-SECURITY.md`)

## Context

Entrega I §9 classifies data as pública, confidencial, and restringida. Local Docker engines and the Firestore emulator are academic fixtures. Identity and refresh sessions belong to Hospital PostgreSQL. Seeds must not invent credentials in tracked files.

## Decision

Adopt the C5 role and classification matrix: API roles `administrador`, `recepcion`, `medico`, `auditor`; separate runtime database principals `genki_app`, `genki_identity`, and `genki_report` (Mongo `genkiApp` / `genkiReporter`). Migration owner is distinct from runtime logins. Identity SoR stays Hospital PostgreSQL; clinical engines hold no password hashes. Document §9.5 encryption-at-rest and field-level encryption aspirations as deferred. There is no TLS or encryption-at-rest claim for local emulators, and this ADR does not assert that encryption was implemented. Seed passwords come only from the `SEED_PASSWORD` environment variable (env-only); `.env.example` lists names with empty values. The seed fixture matrix in C5.5 fixes per-institution catalogs, patients 101/102/103, pediatric guardians, and synthetic `demo-<institutionId>-<role>@example.invalid` accounts.

## Consequences

Later security SQL/TS tickets implement the grants against real engines. Seeds hash `SEED_PASSWORD` with Argon2id and never reset existing passwords without a dedicated reset flag. No Firebase cloud account work belongs here.
