# Entrega II executable plan index

Authorized execution package for the bounded Genki Health MVP. Scope contract is frozen in `docs/plan/contracts/CORE.md` (C1). Planning assumptions A1–A15 are summarized below and in `AGENTS.md`. Machine-readable ticket metadata, file ownership, and dependency edges live in `docs/plan/tickets/index.json`. Gate evidence lives in `docs/gate-checklist.md` (G0–G8).

## Current base

- Merged #8 Chen diagrams on `main` (unchanged).
- Rebased #9 scaffold + Auth landed via P0 integration; content is on `main`.
- Frozen contract packs through E2-P1-03 are on disk under `docs/plan/contracts/` and `docs/plan/ddl/`.
- This ticket (E2-P1-04) installs the executable index and path-origin registry. It does not implement product behavior.

## Assumptions (A1–A15)

> **FROZEN — Codex execution plan.** No further design changes without a CCR (change-control request).

Ratified by Carlos via Grok Bot 2026-11-05 ~19:31 GT (card t308s1248); A8 ownership changed. Execution authorized 2026-11-06.

- **A1 CONFIRMED — MVP cut.** Run login/refresh/logout, register+expediente+inline pediatric guardian, search/detail/history, atomic consultation+diagnoses+treatments+optional prescription, archive on all FOUR physical engines. Five shared screens; all other OP portions explicitly deferred, no fake-success stubs.
- **A2 CONFIRMED — Integration policy.** Merge #8 unchanged; take #9 out of draft and land its rebased content as the P0 base on a new integration branch, then close #9 as superseded. Never force-push its shared branch.
- **A3 ASSUMPTION — E1-05 sequencing.** Jordin finishes existing E1-05 in a parallel documentation lane; it does not block E2.
- **A4 ASSUMPTION — Firebase target.** Use Firestore emulator for development, CI AND demo. No real project work in the critical path.
- **A5 ASSUMPTION — Roles and grants.** Adopt C5 minimal runtime app/identity/report-role matrix plus per-institution Firestore deny-by-default rules and Mongo collection roles; no full RBAC admin UI or encryption-at-rest implementation.
- **A6 CONFIRMED — Identity system of record.** Keep the locked AuthPort/JWT approach; phase0 memory only for tests, all live-demo identities/refresh sessions persisted in Hospital PostgreSQL.
- **A7 ASSUMPTION — Professor feedback.** Assume no unprovided professor correction is required; current transcription plus E1-06 is the corrected model baseline.
- **A8 CHANGED — Agent execution ownership.** Agents execute everything. Jordin does not program. Carlos is PM/approver only (merge policy, submission, secrets). Every E2 ticket Owner is agent.
- **A9 ASSUMPTION — AGENTS override.** P0 updates AGENTS/DoD/needs-human to permit this bounded E2 package; initial ports/schema/CI changes are protocol-change PRs reviewed by both owners.
- **A10 ASSUMPTION — Clinical UX and laboratory extension.** Use one atomic consultation composer, not staged saves. The same closed-consultation flow runs on Laboratory as a labeled academic core extension; it is not OP48–54 exams.
- **A11 ASSUMPTION — Physical schema and locks.** Freeze C4 SQL types/FKs/indexes and C5 document layouts now; E1-06 hospital lock tables are structural only, MySQL excludes hospitalización; conditional colegiado checked by seeder metadata, no invented professional FK.
- **A12 ASSUMPTION — Session boundary.** Retain exact JWT claims, Argon2id, 30m access/14d rotating refresh; logout revokes refresh and clears browser but already issued access lasts to expiry.
- **A13 ASSUMPTION — Data and execution capacity.** Use fake seeded data, env-only passwords, localhost raw engines, agents executing all implementation with Carlos as PM/approver only.
- **A14 ASSUMPTION — Repository and operations.** Keep current private visibility; owner-operated branch protection/check requirements and final course submission stay external operational steps.
- **A15 ASSUMPTION — Deadline and freeze.** Target complete package by 17:00 Nov 9 America/Guatemala (UTC-6), internal functional freeze 12:00 Nov 9; professor cutoff time is not asserted.

## Schedule windows

| Date/window | Lane A (agents; dependency-ready) | Lane B (agents; dependency-ready) | Exit gate / buffer |
| --- | --- | --- | --- |
| Nov5 17:30–Nov6 00:30 | P0-01/02/03; P1-01/02 | P1-03/04 after API pack; E1-05 in separate doc agent lane | G0/G1 and frozen spec pack |
| Nov6 00:30–23:00 | P2-01/03/04/07/08/10; P3a-01 infra in isolated concurrent lane | P2-02 suite/05 domain/06 memory clinical/09 auth. P4b-01 emulator setup when infra ready | G2 memory+API+all named transitions green; physical engines ready |
| Nov7 08:00–22:00 | P3a-02/03/04/05/06 in lane1; P4a-01/02 then P5-03/04 UI in lane2 | P3b-01/02/03/04; P4b-02 transaction lane. E1-05 render lane outside core files | G3 SQL both; Mongo/Firestore transactions exercised early |
| Nov8 08:00–22:00 | P4a-03/04 and P5-02 real composition; UI bug-fix/rebase only after Nov7 early UI lane | P4b-03/04/05; P5-01 seeds,05 smoke,06 native proof after UI; begin note factual outline | G4 document/security; G5 smoke x4 and restart/native probes |
| Nov9 08:00–12:00 | P5-07 full CI; bug-fix buffer only, no feature expansion | P6-01 Spanish note using actual evidence; rerun failed smoke only after fixes | G6 matrix/coverage/security. Functional freeze 12:00 |
| Nov9 12:00–17:00 | P6-02 export/rehearse; P6-03 tracker close | Cross-validation/rehearsal, E1-05 final doc cleanup independent | G7/G8 package by 17:00, human submission afterward |

## Ticket dependency index

Canonical machine source: `docs/plan/tickets/index.json`. Prompt bodies live in `poteto-mode/queue/tickets/` when claimed. Do not invent ticket bodies here.

| Id | Title | Phase | Depends on | Hours |
| --- | --- | --- | --- | --- |
| E2-P0-01 | Adopt the E2 base and lift the stale E1-only gate | P0 | — | 2 |
| E2-P0-02 | Synchronize all baseline trackers and governance pointers | P0 | E2-P0-01 | 1 |
| E2-P0-03 | Make the base CI reliable on main | P0 | E2-P0-01 | 1.5 |
| E2-P1-01 | Commit the frozen API and port specification pack | P1 | E2-P0-02 | 1 |
| E2-P1-02 | Commit the frozen SQL physical schema pack | P1 | E2-P1-01 | 1 |
| E2-P1-03 | Commit document/security/seed contracts and mapping ADRs | P1 | E2-P1-01 | 1.5 |
| E2-P1-04 | Install executable ticket prompts and gate checklist | P1 | E2-P1-02, E2-P1-03 | 1 |
| E2-P2-01 | Add MVP DTOs, strict HTTP schemas and typed clinical errors | P2 | E2-P1-01, E2-P1-04 | 2 |
| E2-P2-02 | Freeze one adapter contract suite including native rollback failures | P2 | E2-P2-01 | 2.5 |
| E2-P2-03 | Give memory real isolated transactions and stable registry instances | P2 | E2-P2-02 | 2 |
| E2-P2-04 | Complete memory patient registration, guardians, search and archive | P2 | E2-P2-03 | 2.5 |
| E2-P2-05 | Implement pure consultation bundle invariants | P2 | E2-P2-01 | 1.5 |
| E2-P2-06 | Implement memory closed consultation aggregate and turn contract suite green | P2 | E2-P2-04, E2-P2-05 | 3 |
| E2-P2-07 | Expose patient search, detail, catalog and archive HTTP slices | P2 | E2-P2-06, E2-P2-01 | 2 |
| E2-P2-08 | Wire atomic consultation use case and HTTP save | P2 | E2-P2-06, E2-P2-07 | 2 |
| E2-P2-09 | Extract storage-neutral JWT service with persistent-session port | P2 | E2-P2-01 | 3 |
| E2-P2-10 | Close the core memory gate with coverage and API isolation tests | P2 | E2-P2-09, E2-P2-08 | 1.5 |
| E2-P3A-01 | Provision deterministic local engines and safe bootstrap commands | P3a | E2-P1-03, E2-P2-02 | 2.5 |
| E2-P3A-02 | Create PostgreSQL migrations, type mapping and scoped transaction wrapper | P3a | E2-P3A-01, E2-P1-02, E2-P2-06 | 2 |
| E2-P3A-03 | Implement PostgreSQL patient registration, read/search and archive | P3a | E2-P3A-02 | 2.5 |
| E2-P3A-04 | Implement PostgreSQL atomic consultation bundle and pass shared suite | P3a | E2-P3A-03 | 2.5 |
| E2-P3A-05 | Persist all four institutions identities and refresh sessions in Hospital PG | P3a | E2-P3A-02, E2-P2-09 | 2.5 |
| E2-P3A-06 | Enforce and prove PostgreSQL least-privilege roles | P3a | E2-P3A-04, E2-P3A-05 | 1.5 |
| E2-P3B-01 | Create MySQL InnoDB schema and transaction/type mapping | P3b | E2-P3A-01, E2-P1-02, E2-P2-06 | 2 |
| E2-P3B-02 | Implement MySQL pediatric registration, guardians and patient queries | P3b | E2-P3B-01 | 2.5 |
| E2-P3B-03 | Implement MySQL consultation bundle and shared contract runner | P3b | E2-P3B-02 | 2.5 |
| E2-P3B-04 | Enforce and prove MySQL app/report roles | P3b | E2-P3B-03 | 1.5 |
| E2-P4A-01 | Create Mongo validators/indexes and real replica-set transactions | P4a | E2-P3A-01, E2-P1-03, E2-P2-06 | 2 |
| E2-P4A-02 | Implement Mongo patient/expediente/guardian transactions and search | P4a | E2-P4A-01 | 2.5 |
| E2-P4A-03 | Implement Mongo bounded embedded consultations and full contract runner | P4a | E2-P4A-02 | 2.5 |
| E2-P4A-04 | Enforce and prove Mongo app/report permissions | P4a | E2-P4A-03 | 1.5 |
| E2-P4B-01 | Pin Firestore emulator, collection indexes and tested deny-by-default rules | P4b | E2-P1-03, E2-P3A-01 | 1.5 |
| E2-P4B-02 | Implement Firestore buffered read-before-write UoW and integer mapping | P4b | E2-P4B-01, E2-P2-06 | 3 |
| E2-P4B-03 | Implement Firestore registration, uniqueness reservation, search and archive | P4b | E2-P4B-02 | 2.5 |
| E2-P4B-04 | Implement Firestore bounded consultation aggregate and shared runner | P4b | E2-P4B-03 | 2.5 |
| E2-P4B-05 | Prove Firestore backend isolation separately from rules | P4b | E2-P4B-04 | 1.5 |
| E2-P5-01 | Create idempotent fake seeds for four institutions and identity | P5 | E2-P3A-04, E2-P3A-05, E2-P3B-03, E2-P4A-03, E2-P4B-04 | 3 |
| E2-P5-02 | Wire real engine composition and fail-fast startup | P5 | E2-P3A-06, E2-P3B-04, E2-P4A-04, E2-P4B-05, E2-P2-10 | 2 |
| E2-P5-03 | Build engine-agnostic login, patient search and registration screens | P5 | E2-P2-10, E2-P1-04 | 3 |
| E2-P5-04 | Build complete history, consultation composer and archive confirmation UI | P5 | E2-P5-03, E2-P2-08 | 3 |
| E2-P5-05 | Create one Playwright core smoke run for each institution | P5 | E2-P5-01, E2-P5-02, E2-P5-04 | 2.5 |
| E2-P5-06 | Prove persisted writes and restart survival in the correct physical store | P5 | E2-P5-05 | 2 |
| E2-P5-07 | Make full CI contract matrix, coverage, security and e2e required gates | P5 | E2-P5-06, E2-P0-03 | 2.5 |
| E2-P6-01 | Assemble the Spanish comparative note from verified ADRs | P6 | E2-P5-06, E2-P1-03 | 2 |
| E2-P6-02 | Package comparative PDF and rehearse the reproducible demo | P6 | E2-P6-01, E2-P5-07 | 1.5 |
| E2-P6-03 | Close Entrega II trackers against evidence without erasing deferred work | P6 | E2-P6-02, E2-P0-02 | 1 |

## Contracts on disk

| File | Role |
| --- | --- |
| `docs/plan/contracts/CORE.md` | C1 scope, vocabulary, invariants, MVP screens |
| `docs/plan/contracts/API.md` | C2 HTTP surface |
| `docs/plan/contracts/PORTS-TESTS.md` | C3 ports and contract suite cases |
| `docs/plan/contracts/DTO-BASELINE.ts` | Shared DTO baseline names/types |
| `docs/plan/contracts/SQL.md` | C4 SQL notes |
| `docs/plan/ddl/postgres.sql` | C4a Hospital PostgreSQL DDL |
| `docs/plan/ddl/mysql.sql` | C4b Pediatric MySQL DDL |
| `docs/plan/contracts/DOCUMENTS-SECURITY.md` | C5 documents, security, seeds |
| `docs/plan/contracts/mongodb-schema.json` | Mongo validators/indexes shape |
| `docs/plan/tickets/index.json` | Executable ticket + path-origin registry |
| `docs/gate-checklist.md` | G0–G8 acceptance gates and evidence |

Path ownership for newly created files is recorded in `docs/plan/tickets/index.json` (`created_by`). Structural checks live in `scripts/test/plan-paths.test.mjs`.
