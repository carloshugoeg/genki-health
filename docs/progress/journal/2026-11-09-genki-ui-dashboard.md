# Journal for cursor/genki-ui-dashboard

Date: 2026-11-09
Branch: `cursor/genki-ui-dashboard`
Base: `ba8e2b39ee24b8db7aba8543df9735e24c4c692c`

## Work

Carlos needed names instead of bare patient and professional numbers, a basic sidepanel dashboard for the morning demo, and a second `npm run db:setup:all` that finishes.

1. `EntitySelect` submits the numeric id and shows `Nombre Apellido (#id)`. Agenda, economic forms, invoicing, payments, dental balance, procedures, and the dental panel use it. History rows and economic results use the same label.
2. `AppShell` wraps institution screens. Login and the superadmin panel stay full page. `/` and `/inicio` are the home dashboard. Counts come from the existing patient list, today's agenda, and each patient's pending charges.
3. MySQL bootstrap skips the `reactivacion_audit` grant until the table exists. Seed keeps going for patients 101 and 103 when a closed academic consult is already there, and it still rejects any history on patient 102. Postgres `security.sql` revokes leftover identity `SELECT` and clinical `DELETE` from `genki_app` after the grants. The charges seed already calls `seedPersonnel` for postgres, mysql, mongodb, and firebase, so professional id 1 is inserted only when missing.

## Verification

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm test` passed. Shared had no test files. Server 159 passed and 32 skipped. Web 11 passed. `trackers_name_same_next_ticket` did not run in this suite.
- `npm run db:setup:all` was not run. This environment has no Docker and no `.env`.

## Open

Pending charges on the home page are added in the browser. The sum stops after 20 pages of 50 patients. The patient total on the card still uses the list `total`.
