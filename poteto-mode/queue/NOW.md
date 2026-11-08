# Now

**No active agent claim.** E2-P4A-01 is Done on `cursor/e2-p4a-01-mongo-schema-bcc8` (stacked on `cursor/e2-p3a-01-provision-55f2`). Do not start the next ticket until an owner opens that claim.

## Agent lane (dependency-ready)

- **Next:** E2-P2-07 — Expose patient search, detail, catalog and archive HTTP slices (depends on E2-P2-06 + E2-P2-01; ready when claimed).
- E2-P4A-02 — Mongo patient/expediente/guardian transactions (depends on E2-P4A-01; ready when claimed).
- E2-P2-09 — Extract storage-neutral JWT service with persistent-session port (depends on E2-P2-01; ready when claimed).
- E2-P3A-02 — Create PostgreSQL migrations, type mapping and scoped transaction wrapper (depends on E2-P3A-01 + E2-P1-02 + E2-P2-06; ready when claimed).
- E2-01 scaffold history remains on PR #9 until ship marks it superseded; content is already on `main` via PR #10.

## Parallel Entrega I notes

- E1-03 is Done (merged PR #8). Do not rewrite its Chen diagrams.
- E1-05 (Jordin/Claude) remains backlog for pediatric Chen diagrams only. It runs in parallel and does not block E2.
- E1-02, E1-04, E1-06 are merged on `main`.
