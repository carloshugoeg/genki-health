# Journal — genki-integration 2026-11-09

## What

Merged Codex lanes A (`d7c4e66`, caja/inventario/honorarios/facturación) and B (`5a22b7d`, agenda) onto `cursor/genki-fixes-1` @ `321b1e8` with merge commits (no rebase). Both merges were clean (no overlapping file edits vs the stack).

## Wiring after merge

- Extended PG/MySQL `security.sql` for `lane_a_*` and agenda tables (idempotent; missing-table safe).
- Routed A/B role gates through central `assertRoles` (superadmin bypass; `id_usuario` unchanged).
- Mounted `GET /api/agenda` and `GET /api/tarifario` via `lane-ab-routes.ts`.
- Added `npm run db:setup:all` for bootstrap → migrate → module migrate/seed across four engines.
- UI: `/agenda` and `/economia` nav entries.

## Checks

lint / typecheck / build / auth+HTTP tests including the new superadmin A+B test. Native persistence harnesses not run (Docker unavailable). Known base failure `trackers_name_same_next_ticket` may remain.

## Combined setup

```bash
npm run db:setup:all
```

## Follow-up

`db:bootstrap` firebase branch and agenda Firebase fixture now honor `FIRESTORE_MODE=real` (ADC + non-demo project) without requiring `FIRESTORE_EMULATOR_HOST`, matching the charges harness.
