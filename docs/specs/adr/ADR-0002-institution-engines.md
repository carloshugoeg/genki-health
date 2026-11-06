# ADR-0002 — Institution to engine assignment

- Status: Accepted
- Date: 2026-08-27

## Context

Four independent institutions must each use a different engine once.

## Decision

| Institution | Engine |
| --- | --- |
| Hospital general | PostgreSQL |
| Centro médico pediátrico | MySQL |
| Laboratorio clínico | MongoDB |
| Clínica odontológica | Firebase (Firestore) |

Encoded in `@genki/shared` as `INSTITUTION_ENGINE_ASSIGNMENTS`.

## Consequences

Carlos owns Postgres + Mongo adapters and CI. Jordin owns MySQL + Firebase adapters and the contract suite. Comparative Spanish note still required for Entrega II submission.
