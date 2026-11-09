# Journal — Lane 2 specialties

Date: 2026-11-09
Branch: `cursor/genki-lane-2-specialties` from `cursor/genki-lane-1-clinical-shared` @ `e133a4d40f2b3ef800a65f0e8084ab1628ede1ed`

## Done

- Hospital PG: OP34 camas, OP35 ingreso, OP36 nota, OP38 egreso (OP37 skipped).
- Pediatría MySQL: OP40–47 growth/vaccines/milestones; WHO percentiles not fabricated.
- Laboratorio Mongo: OP48–54 intake/results.
- Odontología Firestore: OP55–58 chart/plan (FS-19 skipped).
- Memory adapters for all specialty slugs; native adapters only on assigned engines.
- HTTP specialty routes + institution-gated UI panels.
- Migrations/seeds for PG beds and MySQL pediatrics tables/catalog.

## Verify

- `npm run typecheck` OK
- `npm run lint` OK (after unused import fix)
- Native suite `server/test/full/lane2-specialty.persistence.test.ts` skipUnless engines present
