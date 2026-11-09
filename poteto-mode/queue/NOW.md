# Now

**No active agent claim.** E2-P3A-03 is Done on `cursor/e2-p3a-03-pg-paciente-a348` (stacked on `cursor/e2-p3a-02-pg-migrations-e038`). Do not start the next ticket until an owner opens that claim.
**No active agent claim.** E2-P3B-04 is Done on `cursor/e2-p3b-04-mysql-security-4d65` (stacked on `cursor/e2-p3b-03-mysql-consulta-b7cc`). Do not start the next ticket until an owner opens that claim.
**No active agent claim.** E2-P4A-04 is Done on `cursor/e2-p4a-04-mongo-permissions-f1c6` (stacked on `cursor/e2-p4a-03-mongo-consulta-26d7`). Do not start the next ticket until an owner opens that claim.
**No active agent claim.** E2-P4B-01 is Done on `cursor/e2-p4b-01-firestore-rules-a575` (stacked on PR #25 / P3A-01). Do not start the next ticket until an owner opens that claim.

## Agent lane (dependency-ready)

- **Next:** E2-P2-07 — Expose patient search, detail, catalog and archive HTTP slices (depends on E2-P2-06 + E2-P2-01; ready when claimed).
- E2-P2-09 — Extract storage-neutral JWT service with persistent-session port (depends on E2-P2-01; ready when claimed).
- E2-P3A-04 — Implement PostgreSQL atomic consultation bundle and pass shared suite (depends on E2-P3A-03; ready when claimed).
- E2-P3A-02 — Create PostgreSQL migrations, type mapping and scoped transaction wrapper (depends on E2-P3A-01 + E2-P1-02 + E2-P2-06; ready when claimed).
- E2-P4B-01 — Pin Firestore emulator, collection indexes and tested deny-by-default rules (depends on E2-P1-03 + E2-P3A-01; ready when claimed).
- E2-P4B-02 — Implement Firestore buffered read-before-write UoW and integer mapping (depends on E2-P4B-01 + E2-P2-06; ready when claimed).
- E2-01 scaffold history remains on PR #9 until ship marks it superseded; content is already on `main` via PR #10.

## Parallel Entrega I notes

- E1-03 is Done (merged PR #8). Do not rewrite its Chen diagrams.
- E1-05 (Jordin/Claude) remains backlog for pediatric Chen diagrams only. It runs in parallel and does not block E2.
- E1-02, E1-04, E1-06 are merged on `main`.

## Authorized private seed lane

E2-P5-01 implemented by Codex on `codex/e2-p5-01-seeds-private-20261108-01`; physical verification pending. Carlos resolved the previous fixed-ID/API mismatch by authorizing native demo bootstrap. Existing lane notes above are historical dependency evidence. No P5-02 claim or work. No new ticket was started.
