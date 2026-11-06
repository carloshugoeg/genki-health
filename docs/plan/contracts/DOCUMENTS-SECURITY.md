# Frozen C5 — document models, permissions, environment and seed

## C5.1 MongoDB 7 (Laboratorio, institution 3)

Database `genki_laboratorio`, replica set rs0. All documents include `institution_id:int` and numeric surrogate ids; `_id` is `<institution>:<numeric id>` except immutable catalog keys `<institution>:<catalog id>`. DTO projection removes `_id`, metadata, and converts BSON Date to ISO UTC. Birth/treatment dates stored YYYY-MM-DD strings; no ObjectId leaks into DTO.

|Collection|Exact logical contents (required unless marked nullable)|Indexes|
|---|---|---|
|pacientes|`{_id:string,institution_id:int,...PacienteDto}`; institution_id equals id_institucion|unique institution_id/id_paciente; unique institution_id/numero_documento|
|expedientes|`{_id:string,institution_id:int,...ExpedienteDto,_rev:int}`|unique institution_id/id_expediente; unique institution_id/id_paciente; unique institution_id/numero_expediente; institution_id/estado/id_paciente|
|responsables|`{_id:string,institution_id:int,id_responsable:int,id_paciente:int,...ResponsableInput}` with missing correo/direccion mapped null|institution_id/id_paciente; unique institution_id/id_paciente partial filter es_principal:true|
|consultas|`{_id:string,institution_id:int,...ConsultaDto,diagnosticos:DiagnosticoDto[],tratamientos:TratamientoDto[],receta:RecetaDto|null,detalles:DetalleRecetaDto[]}`|unique institution_id/id_consulta; institution_id/id_expediente/fecha_hora_inicio desc/id_consulta desc|
|municipios|`{_id:string,institution_id:int,id_municipio:int,nombre:string}`|unique institution_id/id_municipio|
|profesionales|`{_id:string,institution_id:int,id_profesional:int,nombres:string,apellidos:string,numero_colegiado:string|null,activo:bool}`|unique institution_id/id_profesional; nullable colegiado uniqueness by partial type string|
|medicamentos|`{_id:string,institution_id:int,id_medicamento:int,nombre_generico:string,activo:bool}`|unique institution_id/id_medicamento|
|catalogo_cie10|`{_id:string,institution_id:int,codigo_cie10:string,descripcion:string}`|unique institution_id/codigo_cie10|
|counters|`{_id:'<institution>:<name>',institution_id:int,name:string,next:int}`|_id unique|

Create collection validators in `server/src/adapters/mongodb/schema.ts` using `$jsonSchema`, validationLevel strict / validationAction error. `additionalProperties:false` on each top-level document and nested clinical DTO; list `_id` explicitly. Every id bsonType int; flags bool; text string; nullable fields bsonType ['string','null'] (nullable integer id_municipio etc ['int','null']); timestamps BSON date except source DATE fields. Bound array sizes exactly C2: diagnoses1–10, treatments1–20, details0–20; recipe null iff detalles empty; app validates cross-field conditions. Validators derive exact DTO field list from C2 + existing shared clinical.ts, no unlisted arbitrary payload. Required array fields always present. Patient/repository validates foreign reference existence in the transaction, since Mongo has no FK.

**Embed vs reference:** bounded diagnosis/treatment/prescription details embed inside a consultation, one atomic logical clinical bundle (<256 KiB enforced in application before save); consultations never embed into patient or expediente because history is unbounded. Guardians separate, transactional with patient/expediente to demonstrate rollback. Catalogs referenced by integer key, copied per institution. Deferred exam results will be separate documents referencing an order, never an unbounded patient array; no unused exam collection is implemented. ADR-0003 records these reasons, integer keys and rs0 requirement.

## C5.2 Firestore (Odontología, institution 4)

Emulator project id `demo-genki-health`, host `127.0.0.1:8080`; fixed demo id is not a credential. Documents under `institutions/{institutionId}` where institutionId is the decimal string (`4`). Child collection layout:

```
patients/{id}       -> PacienteDto (including numeric id_institucion)
records/{id}        -> ExpedienteDto + revision:number
responsibles/{id}  -> ResponsableInput + id_responsable,id_paciente
consultations/{id} -> ConsultaDto + diagnosticos[],tratamientos[],receta,detalles
municipios/{id}    -> {id_municipio,nombre}
professionals/{id} -> {id_profesional,nombres,apellidos,numero_colegiado,activo}
medications/{id}   -> {id_medicamento,nombre_generico,activo}
cie10/{code}       -> {codigo_cie10,descripcion}
documentKeys/{hex} -> {id_paciente,numero_documento}
counters/{name}   -> {next:number}
reportes/resumen   -> {pacientes_activos:number,pacientes_archivados:number}
```

All fields correspond exactly to C2 DTOs, dates strings (ISO for timestamps). No undefined stored. `documentKeys` id is SHA-256(normalized numero_documento), never raw potentially slash-containing document number; reservation read and create in registration transaction guarantees uniqueness. Records by patient need index/query, not patient id equal expediente id assumption. Consultation embed/reference same as Mongo. Max serialized bundle 256 KiB leaves margin under Firestore 1 MiB limit. Three transaction attempts, query/index definitions in `infra/firebase/firestore.indexes.json`: records estado/id_paciente; consultations id_expediente ASC + fecha_hora_inicio DESC + id_consulta DESC. Patients are read in ascending id and filtered literally/paginated in the backend for the small academic seed dataset. The API returns every matching item through pagination, without a hidden cap; document explicitly that this scan is not a production full-text index. Returned total is exact. ADR-0004 records this tradeoff and no cloud deployment.

**Client/server boundary:** React never uses Firestore SDK. Backend Firebase Admin bypasses rules even in emulator; HTTP auth, scoped ports and engine-local credential isolation enforce backend access. Do not claim these rules secure Admin. Rules deny direct clinical clients, but expose nonclinical report to a reporting custom-claim test identity in the matching institution. Real project is outside this plan. Exact `infra/firebase/firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
 match /databases/{database}/documents {
  function member(i) {
   return request.auth != null && request.auth.token.institution_id == i;
  }
  match /institutions/{i}/reportes/{id} {
   allow read: if member(i) && request.auth.token.role == 'reporter';
   allow write: if false;
  }
  match /institutions/{i}/{document=**} { allow read, write: if false; }
 }
}
```

Rules are OR-combined: recursive deny does not cancel the narrow report allow. Use @firebase/rules-unit-testing for unauthenticated/client reporter tests; test claim institution_id is STRING matching path. Genki JWT is NOT accepted by Firebase and is never passed as a Firebase custom token. reportes/resumen is a static seed snapshot labeled “resumen de carga inicial”, not falsely current reporting; no report UI in MVP. No composite clinical indexes needed for UI direct client because clients are denied; Admin history query still uses the index file.

## C5.3 Role / classification matrix (sección 9)

|Class|Examples in MVP|API role|Database runtime role|Reporting role|
|---|---|---|---|---|
|Pública|institution names, municipio/professional display/medication catalog names|authenticated read (institution list public)|SELECT catalogs|only aggregate nonidentifying report; no raw catalogs containing professional contact|
|Confidencial|patient identity/contact/document, guardian, expediente state|administrador/recepcion write bounded registration/archive; authenticated read|clinical app role: scoped SELECT, INSERT; UPDATE only expediente/counters|no SELECT base tables|
|Restringida|consultation content/diagnoses/treatments/recipes; password hash/JTI|medico/administrador clinical append; no public response with hashes|clinical app clinical insert/select; separate identity role for hashes/session|no clinical or identity read|

Detailed field classification remains Entrega I §9; any omitted/unclassified field is treated restricted, never promoted to public. Demo role set minimal: administrador, recepcion, medico, auditor. auditor read-only API can see clinical records in own institution; it is not the engine reporting role. Seed live demo accounts administrador; supplementary recepcion/medico/auditor used for permission tests. Reject writes for auditor, reject clinical append for recepcion, reject registration/archive for medico. This is a proposed bounded matrix under A5, not retroactive evidence Carlos already approved grants. No full role-management CRUD.

Runtime artifacts:

- PG `server/src/adapters/postgres/security.sql`: create NOLOGIN group roles genki_app, genki_identity, genki_report; REVOKE ALL on schema public from PUBLIC; grant schema USAGE to groups. app SELECT on municipio/especialidad/profesional/catalogo_cie10/medicamento; SELECT,INSERT on paciente/responsable/consulta/diagnostico/tratamiento/receta/detalle_receta; SELECT,INSERT,UPDATE on expediente,id_counter; USAGE,SELECT on identity sequences for inserted tables only. No DELETE/TRUNCATE/DDL/owner privileges. Identity SELECT on usuario/rol/institucion/auth_session; INSERT and UPDATE(revoked_at) on auth_session; no clinical role on usuario. report SELECT only reporte_pacientes view. Migration owner owns view. Revoke all default public privileges. Bootstrap login principals using secrets from env via a parameterized admin script, never a literal password SQL file; grant exactly one group per connection identity. View owner must not be a login used by API.
- MySQL `server/src/adapters/mysql/security.sql`: CREATE ROLE genki_app, genki_report; grants analogous clinical SELECT/INSERT plus expediente/id_counter UPDATE, report SELECT only SQL SECURITY DEFINER reporte_pacientes; no identity tables in pediatric store. Bootstrap users scoped to local Docker network `%` in disposable dev DB (not Internet exposed), SET DEFAULT ROLE; runtime DSN never root. SQL identifiers constant allowlist, admin parameters escaped driver API for account DDL.
- Mongo `server/src/adapters/mongodb/security.ts`: admin creates `genkiApp` role granting find/insert on pacientes/responsables/consultas, find/insert/update on expedientes/counters, update on expedientes/counters, find on catalogs; no remove/drop/createIndex/bypassDocumentValidation. Separate `genkiReporter` find on a read-only `reporte_pacientes` view only (project institution_id/estado grouped counts, no docs). Collections/validators/indexes/view created by bootstrap, not runtime. Enable authentication, single-member rs0 keyfile generated inside container at startup with 0600 perms; no keyfile committed. Reporting view created with owner; reporter cannot query backing collections.
- Firestore security rules as C5.2, scoped server adapter reads/writes only institution 4; emulator listens loopback. Emulator has no IAM; optional real Admin IAM is not claimed to be tested.

Engine security tests use actual least-privilege DSNs/credentials, not migration owner: app cannot delete/drop; reporter can select aggregate and cannot read patient document/diagnosis/hash; identity can rotate refresh and cannot query clinical patient rows. SQL syntax/grants verified with real engine connections. Do not promise pgcrypto, InnoDB encryption or field-level encryption was implemented: document those §9.5 source aspirations as deferred; there is no TLS/encryption-at-rest claim for local emulators. Password hashes remain Argon2id.

## C5.4 Environment and startup

Node22, Docker Compose v2, Java21 (Firestore emulator), npm lockfile. Pin postgres:16-alpine, mysql:8.4, mongo:7 (existing scaffold versions); firebase-tools 14.22.0 + @firebase/rules-unit-testing 4.0.1, playwright 1.56.1, pg 8.13.1, mysql2 3.11.3, mongodb 6.10.0, firebase-admin 13.0.0, @types/pg 8.11.10, @vitest/coverage-v8 matching Vitest2.1.2. npm lock resolves integrity; if a package cannot be fetched, report installation failure, do not silently upgrade. No managed Supabase/Firebase connector needed: this is local raw-driver coursework.

Environment NAMES, no sample values: JWT_SECRET (>=32 random characters), SEED_PASSWORD, POSTGRES_PASSWORD, MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD, MONGO_ROOT_PASSWORD, MONGO_APP_PASSWORD, MONGO_REPORT_PASSWORD, APP_DB_PASSWORD, IDENTITY_DB_PASSWORD, REPORT_DB_PASSWORD; DATABASE_URL, AUTH_DATABASE_URL, PG_ADMIN_URL, MYSQL_URL, MYSQL_ADMIN_URL, MONGODB_URI, MONGO_ADMIN_URI, FIRESTORE_EMULATOR_HOST, GCLOUD_PROJECT, GENKI_MODE=memory|engines. All secrets required, no checked-in fallback. `.env.example` lists these names with empty values and safe fixed nonsecret host/port/project metadata only. `scripts/demo-env.sh` creates ignored `.env` only if absent, uses crypto randomBytes for separate local passwords, `umask 077`, prints names not values. Explicit future bootstrap, no secret values in plan or journal. Root scripts load `.env` with dotenv (pin dotenv16.4.5); server config resolves repository-root .env explicitly relative to its module, and server/vitest.config.ts resolves ../.env. Never overwrite exported CI variables or source .env as shell code. Set Firebase emulator singleProjectMode:false so isolated demo-test projects can share the process. GENKI_MODE defaults memory for unit/dev; engine smoke explicitly sets engines. In engines mode missing/unhealthy engine is fatal startup; never a memory fallback. No Docker published port outside 127.0.0.1.

Canonical commands after infrastructure tickets:

```
npm ci
npm run build -w @genki/shared
bash scripts/demo-env.sh
# Compose always invoked with explicit path; no root docker-compose file exists.
docker compose --env-file .env -f infra/docker-compose.yml up -d --wait postgres mysql mongodb
npm run db:migrate
npm run db:bootstrap
npm run firebase:start
# firebase:start is long-lived; after port8080 readiness, another terminal runs:
npm run db:seed
GENKI_MODE=engines npm run dev -w @genki/server
npm run dev -w @genki/web
```

`firebase:start`: `firebase emulators:start --only firestore --project demo-genki-health --config infra/firebase/firebase.json` using local pinned CLI. CI uses `firebase emulators:exec` around contract/security commands, not an unmanaged background process. SQL migrate tracks versions/checksums in schema_migrations, applies each file once and refuses changed checksum; MySQL DDL is not assumed transactional, each version logged after success, clean disposable DB on failed dev migration. Seeds are idempotent by alternate key/seed fixture id, do not delete records. Only `db:reset:test` may drop a prefixed `genki_test_` database or demo-test project; reject all other names.

## C5.5 Seed spec

Four institutions ids/kinds/engines fixed in C1; each has its own complete fake catalogs. All metadata institution records in Hospital identity store; clinical metadata copies local. No actual URL personnel data or real credentials. Users named `demo-<institutionId>-<role>@example.invalid` (4 demo administrador, 3 supplementary roles per institution) with synthetic username, no real email target. Read one SEED_PASSWORD, validate policy before hashing Argon2id separately for each seeded user. Re-running seed never resets an existing user's password unless a dedicated reset flag absent from this MVP is provided, so seed updates only newly missing accounts.

Per institution: municipio1 “Municipio de prueba”; especialidad1 “General de demostración”; professional1 “Profesional Simulado <id>”, numero_colegiado='DEMO-<id>-1', required by seed metadata type medico; a second nonlicensed professional2 has NULL colegiado, tested invalid blank and duplicate rejected. Two active medications ids1/2 with fake names “Medicamento didáctico A/B”, inactive3 for negative test; CIE10 Z00.0 copied with source public description. Catalogs contain no true contacts.

Patients 101/102/103 per institution, document `DEMO-<institution>-001/002/003`, dates1990-01-01/2018-01-01/1980-01-01, names “Paciente Ejemplo Uno/Dos/Tres”, municipio1, sexo X, contact null. 101 active with one complete consultation (two diagnoses, two treatments, two medication details);102 active no history;103 archived administrativo with history. Institution2 EACH patient has two fake guardians, exactly one principal, created atomically. No actual clinical recommendation: all descriptions “Contenido académico simulado; no usar para atención”. Timestamps fixed 2026-11-01T14:00:00.000Z; display 08:00 America/Guatemala (UTC-6). SQL sequence reset to >103 after explicit fixture inserts; document counters >103. Migration owner performs seeds; no runtime role can write catalogs. Seeds must not run automatically when API boots.

## C5.6 E2E harness and artifact boundary

Playwright uses workers1, Chromium only, baseURL http://127.0.0.1:5174. Its webServer starts ONLY Vite (`API_PROXY_TARGET=http://127.0.0.1:3100 npm run dev -w @genki/web -- --host 127.0.0.1 --port 5174 --strictPort`), reuseExistingServer:false. `web/vite.config.ts` reads API_PROXY_TARGET or preserves current dev default http://127.0.0.1:3000 for both /api and /health.

Worker fixture owns API child created by Node `spawn(process.execPath,['--import','tsx','server/src/main.ts'],{cwd:repoRoot,env:{...env,API_HOST:'127.0.0.1',API_PORT:'3100',GENKI_MODE:'engines'}})`. Load root .env explicitly, wait for /health with bounded30-second readiness, fail if port3100 already occupied. Cleanup sends SIGTERM only to that owned child and awaits exit. Restart-survival test uses this same fixture stop/start, not the user's API or a global process killer. Native probes use disposable test connections and redact all secrets.

Run isolated emulator around seed and browser smoke:

```
bash scripts/demo-env.sh
docker compose --env-file .env -f infra/docker-compose.yml up -d --wait postgres mysql mongodb
npm run db:migrate
npm run db:bootstrap
npx --no-install playwright install --with-deps chromium
npx --no-install firebase emulators:exec --only firestore --project demo-genki-health --config infra/firebase/firebase.json "npm run db:seed && GENKI_MODE=engines npm run test:e2e -- --project=chromium"
```

Do NOT enable Playwright traces, HAR, videos or network dumps: they capture Bearer and login/refresh bodies. Set trace/video/screenshot off globally; on failure a custom fixture may capture a screenshot with login-email/login-password inputs masked. Do not log request/response bodies/headers. CI uploads only these sanitized screenshots plus native counts/hash evidence, never full browser/network state.
