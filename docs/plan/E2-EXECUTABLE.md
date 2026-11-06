# Entrega II executable plan index

Authorized execution package for the bounded Genki Health MVP. Scope contract is frozen in `docs/plan/contracts/CORE.md` (C1). Planning assumptions A1–A15 are summarized in `AGENTS.md` after E2-P0-01.

## Current base

- Merged #8 Chen diagrams on `main` (unchanged).
- Rebased #9 scaffold + Auth on the P0 integration branch `chore/T-E2-P0-01-repo-truth`.
- Gate evidence lives in `docs/gate-checklist.md` (G0–G8).

## Ticket index

P0-01 lands this index and CORE. The remaining executable tickets (through P1-04 and later packs named in the frozen plan) are added to this file by their completing tickets. Do not invent ticket bodies here.

| Id | Title | Status |
| --- | --- | --- |
| E2-P0-01 | Adopt the E2 base and lift the stale E1-only gate | done in this PR |

## Contracts on disk

| File | Role |
| --- | --- |
| `docs/plan/contracts/CORE.md` | C1 scope, vocabulary, invariants, MVP screens |

Additional contract packs (C2+, C3.6 factories, C4 SQL, C5 documents) arrive with their dependency tickets. Do not fabricate those APIs here.
