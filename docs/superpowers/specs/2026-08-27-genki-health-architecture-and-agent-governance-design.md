# Genki Health — Architecture & Agent Governance Design

**Date:** 2026-08-27
**Status:** Approved pending final review
**Partners:** Carlos (hescobar06cvo@gmail.com) and Jordin
**Deadlines:** Entrega I — **Sep 8, 2026** · Entrega II — **Nov 9, 2026**

---

## 1. Purpose

Genki Health is the final project for Bases de Datos II (URL): one clinical-records
platform serving four independent medical institutions, each persisted on a different
database engine (PostgreSQL, MySQL, MongoDB, Firebase), built on hexagonal
architecture so business logic never depends on any engine.

Both partners build through coding agents (Cursor, Claude Code, or others — tools may
change mid-project) and **no human reviews code manually**. Therefore this document
carves in stone: the system architecture, the agent rulebook, the git protocol, the
enforcement machinery that replaces human review, the work split, and the chronogram.
Every future agent session derives its behavior from the artifacts this spec defines.

## 2. Locked decisions

| Decision | Value |
|---|---|
| Stack | TypeScript full-stack: Fastify API + React/Vite web, npm workspaces |
| ORM | **None.** Raw drivers (`pg`, `mysql2`, `mongodb`, `firebase-admin`) + hand-written SQL/migrations — the course grades per-engine modeling, transactions, and security; an ORM would hide exactly that |
| Architecture | Hexagonal (ports & adapters), manual DI in one composition root |
| Repo | Single public GitHub repo; GitHub Actions CI; branch protection + required checks on `main` |
| Dev environment | Docker Compose (Postgres, MySQL, MongoDB) + Firebase emulator; identical images in CI |
| Test policy | Strict TDD; shared contract suite across all engines; 80% coverage floor on `domain/` + `application/` |
| Task memory | In-repo markdown: task board + per-session journals + ADRs |
| Languages | Professor deliverables in Spanish (`docs/entregas/`); all internal engineering docs in English |
| Delegation | **Model B — institution split** (§8) |
| Agent tooling | Tool-agnostic: one `AGENTS.md` rulebook; `CLAUDE.md` and `.cursor/rules` are pointers to it |

## 3. Engine ↔ institution assignment

Ratified by both partners. The justification below seeds the Entrega II comparative
document.

| Institution | Engine | Justification (summary) |
|---|---|---|
| Hospital general | PostgreSQL | Strict transactional integrity for citas/diagnósticos/tratamientos; strongest ACID guarantees, rich constraints, serializable isolation available |
| Centro médico pediátrico | MySQL | Highly structured longitudinal data (growth control, vaccination schedule); frequent short queries suit a simple, mature relational engine |
| Laboratorio clínico | MongoDB | Exam results vary in structure per exam type (hematología ≠ orina ≠ cultivo); document model absorbs schema variability without sparse tables |
| Clínica odontológica | Firebase | No in-house technical staff; fully managed BaaS with zero ops and simple, fast flows for secretaries |

Entrega I consequence: full ER + relational models are produced for the two
relational institutions (Hospital, Pediátrico); the analysis (entities, attributes,
data classification, operations) covers all four.

## 4. System architecture

### 4.1 Hexagonal layout (`server/src/`)

- `domain/` — entities, value objects, business rules. **Imports nothing** outside the
  standard library.
- `application/` — use cases (register patient, open/maintain clinical record, add
  consultation, add diagnosis, add treatment, prescribe medication, archive record,
  list/search patients, institution-specific operations). Imports `domain/` and
  `ports/` only.
- `ports/` — TypeScript interfaces: repository ports per aggregate, `AuthPort`,
  `ClockPort`, `IdPort`, `UnitOfWorkPort` (transaction boundary abstraction).
- `adapters/`
  - `http/` — Fastify routes, controllers, request validation (zod), auth middleware.
  - `memory/` — in-memory reference implementation of all repository ports (the 5th
    adapter; used for use-case TDD and API tests).
  - `postgres/`, `mysql/`, `mongodb/`, `firebase/` — one folder per engine: driver
    wiring, schema/migrations (SQL engines), document mapping (Mongo/Firebase),
    transaction implementation, engine-level security setup.
- `config/` — composition root: environment loading, the **institution → adapter-set
  registry**, DI wiring.

Dependency rule is machine-enforced (dependency-cruiser, §7): domain imports nothing;
application never imports adapters; adapters never import each other; only `config/`
sees everything.

### 4.2 Data flow and engine routing

1. User logs in → API validates credentials → JWT issued carrying `institutionId`.
2. Every request's middleware resolves the adapter set from the registry using the
   token's institution.
3. Use cases receive ports; they never know which engine is behind them.
4. Adding/moving an institution's engine = one registry entry + config. Business logic
   untouched — precisely the rubric's routing requirement.
5. `web/` (React + Vite SPA) consumes the REST API only; the UI is identical
   regardless of active engine (rubric requirement).

Auth/user store: users and their institution assignment live in the Hospital's
PostgreSQL (the platform's "system of record" for identity), accessed through its own
port so it remains swappable. Passwords hashed (argon2/bcrypt).

### 4.3 Domain shape

Shared clinical core across institutions: `Patient`, `ClinicalRecord`,
`Consultation`, `Diagnosis`, `Treatment`, `Prescription`, plus record archival
(deactivation with reason: transfer, death, administrative).

Per-institution extensions (details produced by Entrega I analysis; architecture
reserves the extension points):

- Hospital: appointments (citas) with strict transactional coupling to
  diagnosis/treatment.
- Pediátrico: growth-curve entries, vaccination schedule.
- Laboratorio: exam orders + typed exam results with variable structure.
- Odontológica: simplified dental record (odontogram-lite), fast reception flows.

### 4.4 Consistency & security per engine (to be implemented and documented)

- PostgreSQL: multi-statement transactions (diagnosis+treatment atomicity), FK
  constraints, roles/GRANTs mapping the public/confidential/restricted
  classification.
- MySQL: InnoDB transactions, constraints, roles.
- MongoDB: multi-document transactions via sessions where needed; embed vs reference
  decided per aggregate in ADRs (e.g., exam results referenced, not embedded — a
  patient accumulates hundreds).
- Firebase: batched writes / transactions in Firestore; security rules mapping the
  data classification.

Each of these decisions gets an ADR when implemented; ADRs are later assembled into
the Entrega II comparative document.

## 5. Repository layout

```
genki-health/
├── AGENTS.md                      # THE rulebook (single source of truth)
├── CLAUDE.md                      # pointer → AGENTS.md
├── .cursor/rules/agents.mdc       # pointer → AGENTS.md
├── README.md
├── PROJECT-DESC.md
├── docs/
│   ├── governance/                # workflow.md, git-protocol.md, testing-policy.md,
│   │                              # definition-of-done.md
│   ├── superpowers/specs/         # this spec; future specs
│   ├── specs/adr/                 # ADR-0001..., INDEX.md
│   ├── roadmap/ROADMAP.md         # phases + chronogram (living doc)
│   ├── progress/
│   │   ├── TASKS.md               # task board
│   │   └── journal/               # YYYY-MM-DD-T###.md per session
│   └── entregas/
│       ├── entrega-1/             # Spanish deliverable sources (markdown + mermaid)
│       └── entrega-2/             # comparative doc sources
├── server/                        # Fastify + TS (hexagonal, §4.1)
├── web/                           # React + Vite SPA
├── shared/                        # DTOs / API types shared client-server
├── infra/
│   ├── docker-compose.yml         # postgres, mysql, mongodb
│   └── firebase/                  # emulator config
├── scripts/
│   ├── validate.sh                # full local gate (mirrors CI)
│   ├── seed.ts                    # demo/seed data per engine
│   └── export-entrega.sh          # markdown+mermaid → PDF
└── .github/
    ├── workflows/ci.yml           # required checks (§7)
    └── PULL_REQUEST_TEMPLATE.md
```

## 6. Agent governance

### 6.1 `AGENTS.md` — the rulebook

Tool-agnostic (never names a specific assistant; references files and commands only).
Contents: project context in ~10 lines; the session loop (§6.2); git protocol (§6.3);
TDD policy; recording duties; escalation triggers; the forbidden list (§6.4).
`CLAUDE.md` and `.cursor/rules/agents.mdc` contain only "Read and obey `AGENTS.md`."

### 6.2 The mandatory session loop

Every agent session, any tool:

1. **Orient** — read `AGENTS.md`, `docs/progress/TASKS.md`, and the 3 most recent
   journal entries. No work before orientation.
2. **Claim** — move exactly one task to *In Progress* (owner + date) and commit the
   claim immediately. A claim is a commit → double-claiming surfaces as a git
   conflict, never as silent duplicate work.
3. **Branch** — `feat/T-042-short-slug` (or `fix/`, `docs/`, `chore/`) off
   freshly-pulled `main`.
4. **Build with TDD** — red → green → refactor. New adapter code must pass the shared
   contract suite unmodified.
5. **Validate** — run `scripts/validate.sh`; push only when green.
6. **Record** — write `docs/progress/journal/YYYY-MM-DD-T042.md`: what was done,
   decisions taken, dead ends, next step. One file per session → no merge conflicts.
7. **Ship** — push; open PR from the template (checklist: tests added, validate
   green, journal written, board updated); CI green; squash-merge; the same PR flips
   the task to *Done* and deletes the branch.

### 6.3 Git protocol

- `main` is protected: PR + all required checks green; no direct pushes; no force
  pushes anywhere shared.
- Branch names: `feat|fix|docs|chore/T-###-slug`. Task IDs (`T-###`) link board ↔
  branch ↔ PR ↔ journal.
- Conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). No AI
  co-author trailers; commits use the repo's normal author identity.
- Rebase on `main` before opening/updating a PR. Squash-merge only.
- Cross-validation: each partner's PRs are checked out and validated by the *other*
  partner's agents (run `validate.sh`, run the app if UI-facing), then merged.

### 6.4 Forbidden actions (hard rules)

- Never push to `main` directly; never force-push shared branches.
- Never weaken, skip, or delete a failing test to get green.
- Never modify `ports/` interfaces, DB schemas/migrations already merged, the
  contract suite, `AGENTS.md`, or CI workflows without a PR labeled
  `protocol-change` approved by **both** partners.
- Never guess on domain/business ambiguities: mark the task *Blocked* on the board,
  write a journal note stating the question, and stop.
- Never commit secrets. `.env` files are gitignored; `infra/` ships `.env.example`.

### 6.5 Memory artifacts

- **Task board** `docs/progress/TASKS.md`: one table — `ID · Title · Status
  (Backlog/In Progress/Blocked/Done) · Owner · Branch · PR`. Seeded from the
  chronogram; extended as work is discovered.
- **Journals** `docs/progress/journal/`: append-only, one file per session (§6.2.6).
- **ADRs** `docs/specs/adr/`: numbered `ADR-###-slug.md` (context → decision →
  consequences) + `INDEX.md`. Mandatory for every architectural choice (embed vs
  reference, transaction strategy per engine, security mapping, schema changes).
  ADRs are the raw material for the Entrega II comparative document.

## 7. Enforcement (the substitute for human review)

### 7.1 Test layers

1. **Domain unit tests** — pure, no I/O (Vitest).
2. **Use-case tests** — against `adapters/memory/`; fast TDD of all business rules.
3. **Contract suite** — one parameterized suite run 5× (memory, Postgres, MySQL,
   MongoDB, Firebase emulator): every repository-port behavior + transactional
   integrity cases (e.g., atomic diagnosis+treatment write, induced mid-write
   failure persists nothing) on **all** engines. An adapter is done ⇔ the suite
   passes unmodified. Findings per engine feed the comparative doc.
4. **API tests** — supertest against Fastify wired to memory adapters: routing,
   auth, institution→engine dispatch.
5. **E2E smoke per engine** — login as each institution's user → perform a core
   flow → assert the data landed in the correct engine.

### 7.2 CI — required checks on every PR (`.github/workflows/ci.yml`)

1. `tsc --noEmit` (strict) across workspaces
2. ESLint + Prettier check
3. dependency-cruiser (hexagonal dependency rule, §4.1)
4. Unit + use-case + API tests
5. Contract matrix: 4 engines (service containers + Firebase emulator)
6. Coverage floor: **80%** lines on `server/src/domain` + `server/src/application`
7. **Journal gate**: PRs touching `server/`, `web/`, or `shared/` must add a file
   under `docs/progress/journal/` (script check)

Branch protection on `main` (repo is public): PRs required, all checks required,
linear history, force pushes blocked.

### 7.3 Local mirror

`scripts/validate.sh` = compose up (if needed) + the exact CI sequence. Also wired as
a husky pre-push hook. Agents must run it before every push (§6.2.5).

## 8. Work delegation — Model B: institution split (locked)

| Owner | Institutions / engines | Infra ownership |
|---|---|---|
| **Carlos** | Hospital general (PostgreSQL) + Laboratorio clínico (MongoDB) | CI workflows, `validate.sh`, docker-compose |
| **Jordin** | Centro pediátrico (MySQL) + Clínica odontológica (Firebase) | Contract-suite skeleton, seeds/fixtures, E2E harness |

- Each partner gets one relational + one non-relational engine.
- **Shared core** (domain, application, ports, HTTP API, web skeleton) is a joint
  Phase-2 deliverable: tasks split on the board, every core PR cross-approved.
- Jordin's validator role is expressed through owning the contract suite + E2E
  harness and through cross-validation of Carlos's PRs (and vice versa).
- Entrega I analysis splits the same way: Carlos → Hospital + Laboratorio; Jordin →
  Pediátrico + Odontológica.

(Model A "Builder/Guardian" was considered and rejected by both partners on
2026-08-27 in favor of symmetric SQL+NoSQL exposure.)

## 9. Chronogram

| Phase | Dates | Gate (exit criteria) |
|---|---|---|
| 0 · Foundation | Aug 27–31 | Governance docs + scaffolding merged; Jordin ratifies spec; board seeded; CI skeleton green on a dummy PR |
| 1 · **Entrega I** | Sep 1–8 | In `docs/entregas/entrega-1/`: entities + attributes ×4; Mermaid ER + relational models (Hospital, Pediátrico); 3NF normalization documented; public/confidential/restricted classification ×4; plain-language operations list; exported PDF; **submitted Sep 8** |
| 2 · Core | Sep 9–28 | Domain + all shared use cases green on memory adapter; contract suite v1; auth + JWT + institution routing; REST API; web skeleton (login, patient search, record view) |
| 3 · Relational engines | Sep 29–Oct 12 | Postgres + MySQL adapters pass contract suite; migrations; transactions; roles/GRANTs; Entrega I feedback folded into models |
| 4 · Document engines | Oct 13–26 | MongoDB + Firebase adapters pass contract suite; embed-vs-reference ADRs; Mongo sessions / Firestore batched writes; security rules |
| 5 · Integration + UI | Oct 27–Nov 2 | All flows working in the UI on all 4 engines; E2E smoke green; demo seed data |
| 6 · **Entrega II** | Nov 3–9 | Comparative Spanish doc assembled from ADRs; app polish; dry-run demo; **submitted Nov 9** |

Phases 3–4 run largely in parallel per partner (each owns one engine in each phase);
the dates mark when the *pair* of adapters must be done. Slack: ~1 week absorbed
across phases 3–5.

## 10. Phase-0 scaffolding deliverables (built immediately after spec approval)

1. `AGENTS.md` + pointer files (`CLAUDE.md`, `.cursor/rules/agents.mdc`)
2. `docs/governance/` (workflow, git-protocol, testing-policy, definition-of-done)
3. `docs/roadmap/ROADMAP.md` (chronogram §9 as living doc)
4. `docs/progress/TASKS.md` seeded with Phase 0–2 tasks + `journal/` + ADR skeleton
   (`ADR-0001` records stack/no-ORM; `ADR-0002` records engine assignment)
5. Workspace skeleton: `server/`, `web/`, `shared/` with tsconfig, ESLint, Prettier,
   Vitest, dependency-cruiser configs; hexagonal folders with `.gitkeep` +
   placeholder ports — **no feature code**
6. `infra/docker-compose.yml` + Firebase emulator config + `.env.example`
7. `scripts/validate.sh`, husky pre-push
8. `.github/workflows/ci.yml` + `PULL_REQUEST_TEMPLATE.md`
9. `docs/entregas/entrega-1/` folder with the deliverable's outline (ES) ready for
   Phase 1
10. GitHub setup checklist for the humans: make repo public, enable branch
    protection + required checks, invite Jordin

## 11. Out of scope (YAGNI)

- Deployment/hosting (localhost + emulators only; not graded)
- ORM/query builders; GraphQL; microservices; message queues
- Advanced UI polish beyond "ordered, engine-agnostic visualization"
- Real Firebase project in dev (emulator only; a real project only if the demo
  requires it, decided in Phase 5)
- Multi-language UI, offline mode, mobile

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Entrega I window is only 8 working days | Phase 0 finishes Aug 31; Entrega I tasks pre-seeded on the board; analysis split ×2 partners runs in parallel |
| Firebase emulator friction in CI | Emulator pinned in CI early (Phase 0 dummy run); fallback documented in ADR if flaky |
| Agents drift between tools (Cursor ↔ others) | Single `AGENTS.md`; per-tool files are pointers; CI + validate.sh enforce behavior regardless of tool |
| Task-board merge conflicts | Board edits are single-line status flips; claims committed immediately; journals are per-file |
| Contract suite becomes bottleneck (Jordin-owned) | Suite skeleton is a Phase-2 joint deliverable; `protocol-change` label lets either partner propose additions |
| Coverage gaming (trivial tests) | Contract suite defines behavior explicitly; cross-validation of PRs by the other partner's agents |
