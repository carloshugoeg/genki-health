# AGENTS.md

Genki Health is the Bases de Datos II final project for Carlos Hugo Escobar Gómez and Héctor Jordin Adolfo García Coyoy. One clinical-record platform, four institutions, four database engines. Entrega I is analysis and the relational model. Entrega II is the application. The course brief is `PROJECT-DESC.md`. The Entrega I document is `docs/entregas/entrega-1/`.

Humans own architecture and design. Agents implement the current ticket. Carlos delegates to Cursor. Jordin delegates to Claude.

## Session loop

1. Read this file, `poteto-mode/queue/NOW.md`, `poteto-mode/decisions/locked.md`, and `poteto-mode/decisions/needs-human.md`.
2. Claim the single ticket in `NOW.md`. Set it to in progress in `docs/progress/TASKS.md` with your name and the date, and commit that claim before any other change.
3. Branch from the default branch that already contains `poteto-mode/`. Name it `docs/<ticket-id>-<slug>` for Entrega I work.
4. Do that ticket. Do not start the next one.
5. Check the definition of done in `poteto-mode/definition-of-done.md`.
6. Write `docs/progress/journal/YYYY-MM-DD-<ticket-id>.md`.
7. Open a pull request. The PR moves the ticket only when it merges.

If the ticket says `needs-human`, do not pick it. Leave `NOW.md` on the first ticket that an agent can finish, and stop if every remaining ticket needs a human.

## Scope

Entrega I only, until those tickets are done. Do not scaffold the app, choose an ORM, or add entities. The approved architecture note at `docs/superpowers/specs/2026-08-27-genki-health-architecture-and-agent-governance-design.md` is the Entrega II design. It is not permission to start that work.

## Hard rules

- Do not push to `main`.
- Do not invent clinical entities, attributes, or business rules that are not in the Entrega I document.
- Do not resolve an item in `needs-human.md` by choosing a side. Stop and leave the ticket blocked.
- Do not commit secrets.
- Professor-facing text stays in Spanish, with the section names from the brief. Agent protocol stays in English.
- `poteto-mode/` is the operating system. If a rule here and a ticket disagree, the ticket's acceptance criteria win for that change, and this file wins for everything else.
