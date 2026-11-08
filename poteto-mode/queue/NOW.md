# Now

**No active agent claim.** E2-P2-04 is Done on `cursor/e2-p2-04-memory-patient-e362` (stacked on PR #21 at `1d26ccad`). Do not start the next ticket until an owner opens that claim.

## Agent lane (dependency-ready)

- **Next:** E2-P2-05 — Implement pure consultation bundle invariants (depends on E2-P2-01; ready when claimed).
- E2-P2-09 — Extract storage-neutral JWT service with persistent-session port (depends on E2-P2-01; ready when claimed).
- E2-P2-06 waits on E2-P2-05 as well as the completed E2-P2-04.
- E2-01 scaffold history remains on PR #9 until ship marks it superseded; content is already on `main` via PR #10.

## Parallel Entrega I notes

- E1-03 is Done (merged PR #8). Do not rewrite its Chen diagrams.
- E1-05 (Jordin/Claude) remains backlog for pediatric Chen diagrams only. It runs in parallel and does not block E2.
- E1-02, E1-04, E1-06 are merged on `main`.
