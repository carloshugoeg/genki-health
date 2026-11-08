# Now

**Active parallel claim:** E2-P2-05 — Implement pure consultation bundle invariants (in progress on `cursor/e2-p2-05-consulta-invariants-3351`, stacked on PR #17 / `cursor/e2-p2-01-mvp-dtos-7ad4`). Pure-domain lane only. Do not touch JWT/session files (parallel E2-P2-09).

## Agent lane (dependency-ready)

- **Next:** E2-P2-02 — Freeze one adapter contract suite including native rollback failures (depends on E2-P2-01; ready when claimed).
- E2-P2-05 — Implement pure consultation bundle invariants (claimed; in progress).
- E2-P2-09 — Extract storage-neutral JWT service with persistent-session port (depends on E2-P2-01; ready when claimed).
- E2-01 scaffold history remains on PR #9 until ship marks it superseded; content is already on `main` via PR #10.

## Parallel Entrega I notes

- E1-03 is Done (merged PR #8). Do not rewrite its Chen diagrams.
- E1-05 (Jordin/Claude) remains backlog for pediatric Chen diagrams only. It runs in parallel and does not block E2.
- E1-02, E1-04, E1-06 are merged on `main`.
