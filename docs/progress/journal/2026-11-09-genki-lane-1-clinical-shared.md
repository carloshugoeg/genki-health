# Journal — genki-lane-1-clinical-shared

Branch: `cursor/genki-lane-1-clinical-shared` from `cursor/genki-superadmin` @ `b9acb3eb` (PR #54).
Draft PR: #55 base `cursor/genki-superadmin`.

## Done

- Adopted FS-04/FS-05 memory cores (OP12/15/16/18, OP17).
- Implemented OP26/27 domain + memory + native adapters (PG/MySQL/Mongo/Firestore).
- Wired `AdapterSet.full` and HTTP routes; archive uses OP-18 when modules present.
- UI: ficha/alergias panel on patient record.
- Migrations: PG `0004-clinical-shared.sql`, MySQL `0002-clinical-shared.sql` (driver-friendly, no `DELIMITER`); Mongo schema + Firestore collections/counters.
- Firebase IdPort counters extended for `antecedente` / `alergia` / `documento_adjunto` / `signos_vitales`.
- Native write/reread proof: `server/test/full/lane1-native.persistence.test.ts` (allergy + vitals on PG; allergy on MySQL/Mongo/Firestore).

## Verification

- Memory/HTTP: `npm test -w @genki/server -- test/full/record/memory.test.ts test/full/attachments/memory.test.ts test/full/consultation/memory.test.ts src/adapters/http/app.test.ts` — 48/48
- Native (compose + Firestore emulator + `.env` admin URLs): `npx vitest run test/full/lane1-native.persistence.test.ts` from `server/` — 4/4
- `npm run typecheck -w @genki/server` — pass
- `npm run lint` — pass

## Apply on an existing local DB

Assumes Compose already up and `0001` (and PG `0001`–`0003`) already applied to the live demo databases named in `.env`.

```bash
# PostgreSQL Hospital (demo DB from POSTGRES_DB, default genki_hospital)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f server/src/adapters/postgres/migrations/0004-clinical-shared.sql

# MySQL Pediatría (demo DB from MYSQL_DATABASE, default genki_pediatrico)
mysql --protocol=TCP -h "${MYSQL_HOST:-127.0.0.1}" -P "${MYSQL_PORT:-3306}" \
  -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  < server/src/adapters/mysql/migrations/0002-clinical-shared.sql

# Mongo Laboratorio — idempotent validators + indexes for lane-1 collections
node --import tsx -e '
  import { MongoClient } from "mongodb";
  import { bootstrapMongoDatabase } from "./server/src/adapters/mongodb/schema.ts";
  const uri = process.env.MONGO_ADMIN_URI;
  if (!uri) throw new Error("MONGO_ADMIN_URI required");
  const client = new MongoClient(uri);
  await client.connect();
  await bootstrapMongoDatabase(client, "genki_laboratorio");
  await client.close();
  console.log("mongo schema OK");
'

# Firestore Odontología — no DDL; restart emulator if needed, then seed
npm run firebase:start   # 127.0.0.1:8080 if not already running
npm run db:seed
```

No new seed rows required for lane-1 tables; demo identities stay on `SEED_PASSWORD`.

Native disposable proof (does not mutate demo DBs):

```bash
# with PG_ADMIN_URL, MYSQL_ADMIN_URL, MONGO_ADMIN_URI, FIRESTORE_EMULATOR_HOST set via dotenv
cd server && npx vitest run test/full/lane1-native.persistence.test.ts
```

## Out of scope here

OP-19 reactivation; agenda/charges; multipart binary upload (JSON `archivo_base64` accepted).
