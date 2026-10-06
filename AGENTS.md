# AGENTS.md

Genki Health is the Bases de Datos II final project for Carlos Hugo Escobar Gómez and Héctor Jordin Adolfo García Coyoy. One clinical-record platform serves four independent medical institutions, each on its own database engine (PostgreSQL, MySQL, MongoDB, Firebase). The course brief is `PROJECT-DESC.md`. The Entrega I document lives in `docs/entregas/entrega-1/`.

**Current phase:** Entrega I — analysis and relational model. The repository is documentation-only; there is no application code yet. The approved Entrega II design is at `docs/superpowers/specs/2026-08-27-genki-health-architecture-and-agent-governance-design.md`. Do not scaffold the app until Entrega I tickets are done.

Humans own architecture and design. Agents implement the current ticket. Carlos delegates to Cursor. Jordin delegates to Claude.

## Commands

Verified in this repository on 2026-10-06:

| Command | Result |
| --- | --- |
| `git status` | Works |
| `git --version` | Works (2.43.0) |
| `npm install` | Fails — no `package.json` (Entrega II scaffolding not started) |
| `npm test` | Fails — no `package.json` |
| `npm run lint` | Fails — no `package.json` |
| `dot -Tpng <file>.dot -o <file>.png` | Not verified here — Graphviz (`dot`) is not installed in this agent VM. Documented in `docs/entregas/entrega-1/diagramas/README.md` for Chen diagram renders. |

When Entrega II scaffolding lands, expect `scripts/validate.sh` as the local gate (mirrors CI per the architecture spec). No CI workflow exists yet.

## Repository structure

```
genki-health/
├── AGENTS.md                 # This file — agent rulebook
├── PROJECT-DESC.md           # Course brief (Spanish)
├── README.md                 # Human entry point (Spanish)
├── poteto-mode/              # Agent OS: queue, tickets, decisions
│   ├── queue/NOW.md          # Current ticket
│   ├── decisions/            # Locked and needs-human decisions
│   └── feature-map.md        # Capability status rollup
├── docs/
│   ├── ARCHITECTURE.md       # System behavior summary
│   ├── entregas/entrega-1/   # Entrega I deliverable (Spanish)
│   ├── governance/
│   ├── progress/             # TASKS.md, journals
│   ├── roadmap/
│   └── superpowers/specs/    # Entrega II architecture spec
└── .github/
    ├── CODEOWNERS
    └── PULL_REQUEST_TEMPLATE.md
```

Future Entrega II layout (not present yet): `server/`, `web/`, `shared/`, `infra/`, `scripts/`.

## Conventions

- Professor-facing text in Spanish, with section names from the brief. Agent protocol in English.
- Do not invent clinical entities, attributes, or business rules that are not in the Entrega I document.
- Locked decisions: `poteto-mode/decisions/locked.md`. Open questions: `poteto-mode/decisions/needs-human.md` — do not resolve by guessing.
- Chen diagram shape key in `docs/entregas/entrega-1/diagramas/README.md` is fixed since E1-02. Copy it; do not rewrite.
- Branches for Entrega I tickets: `docs/<ticket-id>-<slug>`.
- Future agents must update `docs/ARCHITECTURE.md` whenever a PR changes application behavior.

## Stop and ask Carlos

Do not proceed without explicit human approval on:

- **Auth** — login flows, JWT claims, password policy, session handling
- **Payments** — billing integration beyond the simulated quetzales + 12% IVA in the model
- **DB migrations** — schema changes once SQL migrations exist in Entrega II
- **Multitenant permissions** — institution routing, role grants, data-classification enforcement
- **Deleting data** — clinical rows are never deleted; archive only (`estado = archivado`)
- **Protocol changes** — `AGENTS.md`, CI workflows, `ports/` interfaces

## Session loop

1. Read this file, `poteto-mode/queue/NOW.md`, `poteto-mode/decisions/locked.md`, and `poteto-mode/decisions/needs-human.md`.
2. Claim the single ticket in `NOW.md`. Set it to in progress in `docs/progress/TASKS.md` with your name and the date, and commit that claim before any other change.
3. Branch from the default branch that already contains `poteto-mode/`. Name it `docs/<ticket-id>-<slug>` for Entrega I work.
4. Do that ticket. Do not start the next one.
5. Check the definition of done in `poteto-mode/definition-of-done.md`.
6. Write `docs/progress/journal/YYYY-MM-DD-<ticket-id>.md`.
7. Open a pull request. The PR moves the ticket only when it merges.

If the ticket says `needs-human`, do not pick it. Leave `NOW.md` on the first ticket that an agent can finish, and stop if every remaining ticket needs a human.

## Progress

In the same change as the work, update that ticket's `Status`, the matching row in `poteto-mode/feature-map.md` (and the rollup at the top of that file), and `poteto-mode/queue/NOW.md` when the current ticket changes. Do not save those updates for a later commit.

## Scope

Entrega I only, until those tickets are done. Do not scaffold the app, choose an ORM, or add entities. The approved architecture note at `docs/superpowers/specs/2026-08-27-genki-health-architecture-and-agent-governance-design.md` is the Entrega II design. It is not permission to start that work.

## Hard rules

- Do not push to `main`.
- Do not invent clinical entities, attributes, or business rules that are not in the Entrega I document.
- Do not resolve an item in `needs-human.md` by choosing a side. Stop and leave the ticket blocked.
- Do not commit secrets.
- Professor-facing text stays in Spanish, with the section names from the brief. Agent protocol stays in English.
- `poteto-mode/` is the operating system. If a rule here and a ticket disagree, the ticket's acceptance criteria win for that change, and this file wins for everything else.
