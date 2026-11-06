# ADR-0004 — Firestore aggregates (Odontología)

- Status: Accepted
- Date: 2026-11-06
- Contract: Frozen C5.2 (`docs/plan/contracts/DOCUMENTS-SECURITY.md`)

## Context

Odontología (institution 4) uses the Firestore emulator project `demo-genki-health` on loopback. React must never talk to Firestore. Document numbers can contain slashes, so they cannot be raw document ids. Consultation history is unbounded the same way as Mongo.

## Decision

Store documents under `institutions/{institutionId}` with child collections for patients, records, responsibles, consultations, catalogs, counters, and a static `reportes/resumen` seed snapshot. Embed bounded clinical details inside consultation documents; keep patient and record histories referenced, not unbounded embeds. Enforce document-number uniqueness with a `documentKeys/{hex}` reservation that uses SHA-256 of the normalized number and a read-before-write create inside the registration transaction. Backend Firebase Admin bypasses security rules even in the emulator; HTTP auth and scoped ports enforce access. Do not claim these rules secure Admin. Deny direct clinical clients; allow only a reporter custom-claim identity to read nonclinical report docs. No cloud Firebase project is created in this plan.

## Consequences

Firestore adapters and rules tests in later tickets copy C5.2 and this ADR. Emulator-only delivery stays the MVP path (A4). Composite clinical indexes exist for Admin history queries, not for browser clients.
