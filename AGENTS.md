# AGENTS.md

Genki Health is the Bases de Datos II final project for Carlos Hugo Escobar Gómez and Héctor Jordin Adolfo García Coyoy. One clinical-record platform serves four independent medical institutions, each on its own database engine (PostgreSQL, MySQL, MongoDB, Firebase). The course brief is `PROJECT-DESC.md`. The Entrega I document lives in `docs/entregas/entrega-1/`.

**Current phase: Entrega II** — bounded MVP client-server application on the four engines. Entrega I analysis and Chen work remain in tree. E1-05 (pediatric Chen) runs in parallel and is not an E2 gate. The frozen scope contract is `docs/plan/contracts/CORE.md`. The executable index is `docs/plan/E2-EXECUTABLE.md`. The approved architecture note remains at `docs/superpowers/specs/2026-08-27-genki-health-architecture-and-agent-governance-design.md`.

Humans own architecture and design. Agents implement the current ticket. Carlos is PM/approver (merge policy, submission, secrets). Agents (Cursor Auto / ship) execute the coding. Jordin does not program for E2. Carlos delegates to Cursor.

## Commands

Verified after the E2-01 scaffold (rebased onto main with E2-P0-01):

| Command | Result |
| --- | --- |
| `git status` | Works |
| `git --version` | Works |
| `npm ci` | Installs workspaces from `package-lock.json` |
| `npm test` | Runs shared + server Vitest suites |
| `npm run lint` | ESLint across the monorepo |
| `npm run format:check` | Prettier check |
| `npm run typecheck` | `tsc --noEmit` in workspaces |
| `npm run depcruise` | Hexagonal dependency rules |
| `bash scripts/validate.sh` | Local gate (install, format, lint, build shared, typecheck, depcruise, test, build web). Ends with `validate.sh OK` |
| `node --test scripts/test/repo-truth.test.mjs` | Repo-truth contract for AGENTS / Auth locks / gate checklist |
| `dot -Tpng <file>.dot -o <file>.png` | Graphviz for Chen renders when installed; see `docs/entregas/entrega-1/diagramas/README.md` |

After P5-07 exists, behavioral PRs also run `VALIDATE_FULL=1 bash scripts/validate.sh`. Final delivery always requires the full gate.

## Repository structure

```
genki-health/
├── AGENTS.md                 # This file — agent rulebook
├── PROJECT-DESC.md           # Course brief (Spanish)
├── README.md                 # Human entry point (Spanish)
├── package.json              # npm workspaces root
├── poteto-mode/              # Agent OS: queue, tickets, decisions
│   ├── queue/NOW.md          # Current ticket
│   ├── decisions/            # Locked and needs-human decisions
│   └── feature-map.md        # Capability status rollup
├── docs/
│   ├── ARCHITECTURE.md       # System behavior summary
│   ├── gate-checklist.md     # G0–G8 evidence
│   ├── plan/                 # E2-EXECUTABLE + contracts/
│   ├── entregas/entrega-1/   # Entrega I deliverable (Spanish)
│   ├── governance/
│   ├── progress/             # TASKS.md, journals
│   ├── roadmap/
│   └── superpowers/specs/    # Entrega II architecture spec
├── server/                   # Fastify API, ports, adapters
├── web/                      # React + Vite SPA
├── shared/                   # Shared DTOs and ids
├── infra/                    # docker-compose, Firebase emulator config
├── scripts/                  # validate.sh, repo-truth tests
└── .github/
    ├── CODEOWNERS
    ├── workflows/ci.yml
    └── PULL_REQUEST_TEMPLATE.md
```

## Conventions

- Professor-facing text in Spanish, with section names from the brief. Agent protocol in English.
- Do not invent clinical entities, attributes, or business rules that are not in the Entrega I document or the frozen E2 contracts.
- Locked decisions: `poteto-mode/decisions/locked.md`. Open questions: `poteto-mode/decisions/needs-human.md` — do not resolve by guessing. Adopted execution assumptions may be appended there without fabricating a historical human answer.
- Chen diagram shape key in `docs/entregas/entrega-1/diagramas/README.md` is fixed since E1-02. Copy it; do not rewrite.
- Branches for Entrega I tickets: `docs/<ticket-id>-<slug>`. E2 integration branches follow the ticket (for example `chore/T-E2-P0-01-repo-truth`).
- Future agents must update `docs/ARCHITECTURE.md` whenever a PR changes application behavior.
- Initial ports, schema, and CI changes are protocol-change PRs reviewed by both owners.

## Stop and ask Carlos

Do not proceed without explicit human approval on:

- **Auth** — login flows, JWT claims, password policy, session handling
- **Payments** — billing integration beyond the simulated quetzales + 12% IVA in the model
- **DB migrations** — schema changes once SQL migrations exist in Entrega II
- **Multitenant permissions** — institution routing, role grants, data-classification enforcement
- **Deleting data** — clinical rows are never deleted; archive only (`estado = archivado`)
- **Protocol changes** — `AGENTS.md`, CI workflows, `ports/` interfaces

Locked Auth decisions (Carlos 2026-10-19) stay in force. Do not reopen them. New Auth product choices still stop here.

## Session loop

1. Read this file, `poteto-mode/queue/NOW.md`, `poteto-mode/decisions/locked.md`, and `poteto-mode/decisions/needs-human.md`.
2. Claim the single ticket in `NOW.md`. Set it to in progress in `docs/progress/TASKS.md` with your name and the date, and commit that claim before any other change.
3. Branch from the default branch that already contains `poteto-mode/`. Use the branch name the ticket names.
4. Do that ticket. Do not start the next one.
5. Check the definition of done in `poteto-mode/definition-of-done.md` and the gate checklist when the ticket reaches a gate.
6. Write `docs/progress/journal/YYYY-MM-DD-<ticket-id>.md`.
7. Open a pull request. The PR moves the ticket only when it merges. Protocol-change PRs need both owners.

If the ticket says `needs-human`, do not pick it. Leave `NOW.md` on the first ticket that an agent can finish, and stop if every remaining ticket needs a human.

## Progress

In the same change as the work, update that ticket's `Status`, the matching row in `poteto-mode/feature-map.md` (and the rollup at the top of that file), and `poteto-mode/queue/NOW.md` when the current ticket changes. Do not save those updates for a later commit.

## Scope

Bounded Entrega II MVP under CORE and the adopted assumptions below. Do not add an ORM, a real Firebase project, extra engines, specialty OPs, or screens outside CORE. Do not treat memory-adapter tests as physical persistence evidence. E1-05 remains a parallel documentation lane.

### Adopted planning defaults (A1–A15)

Ratified by Carlos via Grok Bot 2026-11-05 ~19:31 GT (card t308s1248); A8 ownership changed. Execution authorized 2026-11-06.

- **A1 CONFIRMED** — Run login/refresh/logout, register+expediente+inline pediatric guardian, search/detail/history, atomic consultation+diagnoses+treatments+optional prescription, archive on all FOUR physical engines. Five shared screens; all other OP portions explicitly deferred, no fake-success stubs.
- **A2 CONFIRMED** — Merge #8 unchanged; take #9 out of draft and land its rebased content as the P0 base on a new integration branch, then close #9 as superseded. Never force-push its shared branch.
- **A3 ASSUMPTION** — Jordin finishes existing E1-05 in a parallel documentation lane; it does not block E2.
- **A4 ASSUMPTION** — Use Firestore emulator for development, CI AND demo. No real project work in the critical path. A real project, only if later explicitly requested for the demo, is a separate post-MVP change.
- **A5 ASSUMPTION** — Adopt C5 minimal runtime app/identity/report-role matrix plus per-institution Firestore deny-by-default rules and Mongo collection roles; no full RBAC admin UI or encryption-at-rest implementation.
- **A6 CONFIRMED** — Keep the locked AuthPort/JWT approach; phase0 memory only for tests, all live-demo identities/refresh sessions persisted in Hospital PostgreSQL.
- **A7 ASSUMPTION** — Assume no unprovided professor correction is required; current transcription plus E1-06 is the corrected model baseline.
- **A8 CHANGED** — Agents execute everything: PostgreSQL, MySQL, Mongo, Firestore, CI, seeds, e2e, shared core, UI, and the Spanish note. Jordin does not program. Carlos is PM/approver only (merge policy, submission, secrets). Every E2 ticket Owner is agent; E2 has no Jordin coding dependency.
- **A9 ASSUMPTION** — P0 updates AGENTS/DoD/needs-human to permit this bounded E2 package; initial ports/schema/CI changes are protocol-change PRs reviewed by both owners.
- **A10 ASSUMPTION** — Use one atomic consultation composer, not staged saves. The same closed-consultation flow runs on Laboratory as a labeled academic core extension; it is not OP48–54 exams.
- **A11 ASSUMPTION** — Freeze C4 SQL types/FKs/indexes and C5 document layouts now; E1-06 hospital lock tables are structural only, MySQL excludes hospitalización; conditional colegiado checked by seeder metadata, no invented professional FK.
- **A12 ASSUMPTION** — Retain exact JWT claims, Argon2id, 30m access/14d rotating refresh; logout revokes refresh and clears browser but already issued access lasts to expiry.
- **A13 ASSUMPTION** — Use fake seeded data, env-only passwords, localhost raw engines, agents executing all implementation with Carlos as PM/approver only.
- **A14 ASSUMPTION** — Keep current private visibility; owner-operated branch protection/check requirements and final course submission stay external operational steps.
- **A15 ASSUMPTION** — Target complete package by 17:00 Nov 9 America/Guatemala (UTC-6), internal functional freeze 12:00 Nov 9; professor cutoff time is not asserted.

## Hard rules

- Do not push to `main`.
- Do not invent clinical entities, attributes, or business rules that are not in the Entrega I document or frozen E2 contracts.
- Do not resolve an item in `needs-human.md` by choosing a side. Stop and leave the ticket blocked.
- Do not commit secrets.
- Professor-facing text stays in Spanish, with the section names from the brief. Agent protocol stays in English.
- `poteto-mode/` is the operating system. If a rule here and a ticket disagree, the ticket's acceptance criteria win for that change, and this file wins for everything else.
- Never force-push `cursor/e2-01-app-scaffold-6295`.
