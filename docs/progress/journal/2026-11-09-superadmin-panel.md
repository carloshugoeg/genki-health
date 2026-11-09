# Journal — superadmin panel (2026-11-09)

## Goal

Seed a grading `superadministrador` on Hospital PostgreSQL and let that identity switch institution context without logout, while normal users stay single-institution.

## Done

- Idempotent PG seed of role `superadministrador` (id 5) and user `superadmin@example.invalid` via `SEED_PASSWORD`.
- `AuthPort.selectInstitution` reissues access+refresh with the chosen institution; refresh preserves that selection for superadmin only.
- HTTP `POST /api/auth/select-institution` and web `/panel` with Volver al panel.
- Essential test: superadmin can switch; normal user gets `forbidden`.

## Apply on an existing local DB

Re-run seed only (no new migration files). From repo root with the same admin URLs and `SEED_PASSWORD` already used for the disposable `genki_test_*` databases:

```bash
npm run db:seed
```
