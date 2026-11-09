# Journal — cursor/genki-fixes-2

Date: 2026-11-09
Branch: `cursor/genki-fixes-2`
Base: `cursor/genki-lane-3-users` @ d746c9f49eafeb7d6cb4c4dbe49c1bf95f02fd52

## Work

Mac smoke hotfixes from `cursor/genki-wire-ab` real 4-engine run:

1. PG procedimiento catalog rows expanded; manage falls back to `PG_ADMIN_URL`+`POSTGRES_DB`; hospital-DB GRANTs via bootstrap.
2. Firestore OP59: allow `sesion_tratamiento` (and OP19 `reactivacion_audit`) in `FirebaseId` + UoW; unit + HTTP coverage.
3. Agenda firebase migrate: declare `projectId` in fixtures.
4. Mongo `genkiApp` privileges for lane 1/2 clinical collections + `reactivacion_audit`.
5. Idempotent `lane_a_professionals` id=1 (+ contract) in personnel seed for inventario consumo.

## Verification

- lint / typecheck / build / targeted tests (see PR)
- Native Docker harnesses: skipped (no Docker in this environment)

## Setup command

```bash
npm run db:setup:all
```
