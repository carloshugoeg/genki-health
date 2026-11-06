# ADR-0003 — MongoDB aggregates (Laboratorio)

- Status: Accepted
- Date: 2026-11-06
- Contract: Frozen C5.1 (`docs/plan/contracts/DOCUMENTS-SECURITY.md`, `docs/plan/contracts/mongodb-schema.json`)

## Context

Laboratorio (institution 3) runs on MongoDB 7 with replica set `rs0`. The same clinical DTOs as SQL engines must persist without inventing ObjectId-shaped public ids. Consultation history for a patient is unbounded, so embedding every past consultation under a patient or expediente document would grow without bound and break the academic size and transaction story.

## Decision

Use numeric surrogate integer keys and `_id` shaped `<institution>:<numeric id>` (catalog keys `<institution>:<catalog id>`). Embed bounded diagnosis, treatment, and prescription details inside a consultation as one atomic clinical bundle under 256 KiB. Consultations never embed into patient or expediente because history is unbounded; guardians stay separate documents and write with patient/expediente in one transaction to prove rollback. Catalogs are referenced by integer key and copied per institution. Collection validators live in `server/src/adapters/mongodb/schema.ts` from the frozen `mongodb-schema.json` pack; adapters land in later tickets.

## Consequences

Mongo adapters copy this ADR and C5.1 verbatim for layout. Deferred exam results stay separate documents referencing an order, never an unbounded patient array. Runtime requires authenticated single-member `rs0`. This ADR does not implement validators, roles, or seed execution.
