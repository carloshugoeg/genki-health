# Journal — genki-lane-1-clinical-shared

Branch: `cursor/genki-lane-1-clinical-shared` from `cursor/genki-superadmin` @ `b9acb3eb` (PR #54).
Draft PR: #55 base `cursor/genki-superadmin`.

## Done

- Adopted FS-04/FS-05 memory cores (OP12/15/16/18, OP17).
- Implemented OP26/27 domain + memory + native adapters (PG/MySQL/Mongo/Firestore).
- Wired `AdapterSet.full` and HTTP routes; archive uses OP-18 when modules present.
- UI: ficha/alergias panel on patient record.
- Migrations: PG `0004-clinical-shared.sql`, MySQL `0002-clinical-shared.sql`; Mongo schema + Firestore collections.

## Verification

- `npm test -w @genki/server -- test/full/record/memory.test.ts test/full/attachments/memory.test.ts test/full/consultation/memory.test.ts` — 38/38
- `npm run typecheck -w @genki/server` — pass

## Apply on an existing local DB

```bash
# PostgreSQL (Hospital) — apply ordered SQL migrations including 0004
psql "$PG_ADMIN_URL" -f server/src/adapters/postgres/migrations/0004-clinical-shared.sql

# MySQL (Pediatría) — apply 0002 after 0001
mysql --protocol=TCP -h 127.0.0.1 -u root -p"$MYSQL_ROOT_PASSWORD" genki_demo \
  < server/src/adapters/mysql/migrations/0002-clinical-shared.sql

# Mongo — reinstall validators/indexes (idempotent install path used by harness)
# Firebase emulator — no DDL; new collections appear on first write after restart

npm run db:seed
```

No seed row changes required for lane-1 tables; demo identities stay on `SEED_PASSWORD`.

## Out of scope here

OP-19 reactivation; agenda/charges; multipart binary upload (JSON `archivo_base64` accepted).
