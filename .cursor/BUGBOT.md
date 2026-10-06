# Bugbot review rules — Genki Health

## Always enforce

1. **No secrets** — never commit API keys, passwords, `.env` values, or Firebase service accounts. Use `.env.example` templates only.
2. **Preview readiness** — never report a preview or deployment as ready without probing it for HTTP 200 and a rendered UI.
3. **Reversible migrations** — every SQL migration must include a down/revert path. Flag one-way migrations.
4. **Clinical data integrity** — no hard deletes on clinical records. Archive with reason only (`estado = archivado`).
5. **No invented domain** — entities and attributes must come from `docs/entregas/entrega-1/`, not agent inference.

## Repo-specific risks

- **Entrega I scope creep** — flag PRs that scaffold `server/`, `web/`, `shared/`, or add npm dependencies while Entrega I tickets remain open.
- **needs-human bypass** — flag changes that resolve items in `poteto-mode/decisions/needs-human.md` without a human decision from Carlos or Jordin.
- **Chen shape key drift** — Chen `.dot` files must follow the Graphviz ↔ Chen table in `docs/entregas/entrega-1/diagramas/README.md`. Do not invent new shapes.
- **Spanish deliverable quality** — professor-facing text must stay in Spanish with section names from the brief unchanged.
- **Institution routing** — the user's institution determines the database engine for the whole session. Flag code that leaks engine-specific logic into use cases or domain.
- **Data classification** — public / confidential / restricted mapping must match section 9 of the Entrega I document.
- **Graphviz renders** — if a `.dot` file changes, the matching `.png` should be updated or the PR should explain why not.
- **Locked decisions** — do not reopen items in `poteto-mode/decisions/locked.md` (engine assignment, no ORM, archive-not-delete, simulated billing).
- **Relational model gaps** — `rel-*.mmd` files follow sections 7.4 and 7.5 on purpose. Do not fill gaps from `needs-human.md` in diagrams.
