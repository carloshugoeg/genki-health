# Frozen contract C3 — ports, composition, transactions and test oracles

## C3.1 Port signatures

Existing types imported from `@genki/shared` retain branded ids. Existing `CreatePacienteInput` becomes a type alias of RegisterPacienteRequest; no competing duplicate input shape. Update `server/src/ports/index.ts` exports. These are signatures, not driver implementations.

```ts
// server/src/ports/paciente-repository.ts
export interface SearchPacientesInput {
 q: string; estado: 'activo'|'archivado'|'todos'; page: number; page_size: number;
}
export interface PacienteRepositoryPort {
 createWithExpediente(input: CreatePacienteInput): Promise<PacienteResumen>;
 findById(id: PacienteId): Promise<PacienteDto|null>;
 findByDocumento(tipo_documento: string, numero_documento: string): Promise<PacienteDto|null>;
 findExpedienteByPaciente(id: PacienteId): Promise<ExpedienteDto|null>;
 findExpedienteById(id: ExpedienteId): Promise<ExpedienteDto|null>;
 list(input: SearchPacientesInput): Promise<PacientePage>;
 archiveExpediente(input: ArchiveExpedienteInput): Promise<ExpedienteDto>;
}
// server/src/ports/consulta-repository.ts
// Retain EXACT existing CloseConsultaBundle declaration; no staged-write API.
export interface ConsultaRepositoryPort {
 closeConsulta(bundle: CloseConsultaBundle): Promise<ConsultaCompleta>;
 findById(id: ConsultaId): Promise<ConsultaDto|null>;
 listByExpediente(id: ExpedienteId): Promise<ConsultaCompleta[]>;
}
// server/src/ports/catalogo-repository.ts (new)
export interface CatalogoRepositoryPort {list():Promise<CatalogosDto>}
// server/src/ports/unit-of-work.ts (unchanged)
export interface UnitOfWorkPort {
 runInTransaction<T>(work:()=>Promise<T>):Promise<T>;
}
// server/src/ports/auth.ts — retain existing signatures + add logout
export interface AuthPort {
 login(input:LoginRequestDto):Promise<AuthTokensDto>;
 refresh(refreshToken:string):Promise<AuthTokensDto>;
 verifyAccessToken(accessToken:string):Promise<AuthPrincipalDto>;
 logout(refreshToken:string):Promise<void>;
}
// server/src/ports/identity-store.ts (new)
export interface IdentityUser {
 id_usuario:number; email:string; hash_contrasena:string;
 id_institucion:number; institution_kind:InstitutionKind; roles:string[];
 estado:'activo'|'bloqueado'|'inactivo';
}
export interface RefreshSession {
 jti_hash:string; id_usuario:number; expires_at:string; created_at:string;
}
export interface IdentityStorePort {
 findUser(email:string,kind:InstitutionKind):Promise<IdentityUser|null>;
 findUserById(id:number):Promise<IdentityUser|null>;
 insertRefresh(session:RefreshSession):Promise<void>;
 rotateRefresh(oldHash:string,next:RefreshSession,nowIso:string):Promise<boolean>;
 revokeRefresh(hash:string,nowIso:string):Promise<void>;
}
```

`findByDocumento` keeps its old two parameters for compatibility but compares normalized numero_documento alone within the repository's institution; different document types cannot evade the alternate key. `list` searches OR of exact numero_documento, exact numero_expediente, literal case-insensitive substring of joined names (primer/segundo nombre, primer/segundo apellido separated by single spaces, missing omitted). Empty q matches all. Escape SQL `%`, `_`, backslash and Mongo regex metacharacters; do not interpret user input as a pattern. Sort numeric patient id ascending, page applies after estado filter; total is filtered total. Catalog outputs sorted id ascending and only active professional/medication; municipios all.

## C3.2 Application function signatures and mapping

- `registerPaciente(pacientes, input)` retains existing signature, adds guardian semantic checks inside scoped repository (which knows institution) as defense in depth; HTTP application receives principal and checks role. Repository duplicate constraint is authoritative under races, not just existing precheck.
- `listPacientes(pacientes, query):Promise<PacientePage>` in `server/src/application/list-pacientes.ts` delegates validated query.
- `getHistorial(pacientes, consultas, id_paciente):Promise<HistorialDto>` in `get-historial.ts`: fetch patient + matching expediente, 404 if either absent, then list complete bundles.
- `archiveExpediente(pacientes,clock,input)` retains existing API for compatibility, but resolves expediente by patient and checks input.id_expediente equals it before mutation; mismatch returns not_found. HTTP never gets expediente id from caller.
- `closeConsulta(adapters,input:{id_paciente:PacienteId; body:CloseConsultaRequest}):Promise<ConsultaCompleta>` in `close-consulta.ts`; `adapters` is a structural port-only `ClinicalContext` declared in `server/src/ports/clinical-context.ts`, not an import of config.AdapterSet. It contains pacientes, consultas, catalogos, unitOfWork, clock, ids. In transaction, read expediente, verify active, validateConsulta, map DTOs; existing CloseConsultaBundle consulted directly. `fecha_hora_fin`, diagnóstico.fecha_registro and receta.fecha_emision use clock.nowIso(); consulta.estado='cerrada', id_cita=null; recipe estado='emitida', folio='REC-'+await ids.nextInt('receta_folio'); missing strings → null. Recipe profesional equals consultation professional. Repository validates references and serializes expediente with archive. `ConsultaCompleta.detalles` is [] when no receta.

`AdapterSet.consultas` becomes required, add catalogos; engine metadata retained. Registry caches ONE set per kind+institutionId for entire process. Validate allowed kind/id assignment 1/2/3/4 before resolve; mismatches reject invalid_token at HTTP authentication, not fallback. Memory set engine metadata stays engineForKind for routing tests, but startup explicitly labels memory mode; never represent it as physical persistence.

## C3.3 Transactions

Repositories must run their compound writes inside UnitOfWork. Nested calls JOIN the current transaction; they never commit independently. Driver-local AsyncLocalStorage holds current connection/session/transaction; application sees only callback port. No global mutable transaction connection; concurrent requests isolated. Composition creates one UoW per engine/institution, injects it into repositories and ids.

- Memory: shared institution state object with maps for pacientes, expedientes, responsables, consultas, diagnosticos, tratamientos, recetas, detalles, counters and catalogs. Serialize writers with a promise mutex; clone all maps at outer entry, restore all on failure; reentrant nested joins via AsyncLocalStorage. Reads in transaction see working state; outside reads do not see partial writes (writer publishes snapshot only at commit). Returned DTOs are clones, never live mutable map objects. Counter gaps allowed, no rewinding committed allocations.
- PG: acquire pool client, BEGIN; callback uses that client; COMMIT on success; ROLLBACK then release in finally on failure. SELECT expediente FOR UPDATE for archive and close. Reader queries always institution scoped via patient/expediente joins. SQL pool max 5. Isolation READ COMMITTED sufficient with explicit expediente row lock + unique constraints.
- MySQL: same with pool connection, beginTransaction/commit/rollback/release, InnoDB; SELECT FOR UPDATE; UTC session, named result mapping boolean/date/DECIMAL to DTO; use READ COMMITTED to match PG semantics.
- Mongo: replica set rs0 REQUIRED; session.withTransaction with snapshot read concern, majority write concern. Share session in every query/update/insert/counter. Close and archive each update expediente `_rev` in the transaction to create a write conflict, retry transient conflict at most 3. Unique document keys enforce creation race. Build transaction result inside callback so retry does not duplicate external effects.
- Firestore: firebase-admin against emulator; runTransaction, ALL reads before ALL writes. Read patient, expediente, refs and counter docs first; buffer write intents in UoW; flush only after callback returns and SDK read phase ends. Duplicate document reservation is a read+create in same transaction. Archive/close both read and update expediente metadata `revision` so races conflict. SDK maxAttempts 3. Never do a network call after staged writes outside this UoW.

No external side effect in a transaction callback, no cross-engine transaction with identity, no driver fallback to memory. Counter names are stable strings `paciente`,`expediente`,`responsable`,`consulta`,`diagnostico`,`tratamiento`,`receta`,`receta_folio` for document drivers; SQL generated ids for rows and atomic id_counter row for `receta_folio`.

## C3.4 Shared adapter harness and exact tests

An agent owns `server/test/contracts/clinical.contract.ts`; one exported function `clinicalContract(name:string,make:(options?:{kind?:InstitutionKind})=>Promise<ClinicalHarness>)` uses Vitest describe.each behavior without engine conditionals. Harness lives in `server/test/contracts/harness.ts`:

```ts
export type FailurePoint = 'afterPaciente'|'afterConsulta'|'afterDiagnostico';
export interface ClinicalHarness {
 context: ClinicalContext;
 reset():Promise<void>;
 failNext(point:FailurePoint):void;
 counts():Promise<Record<'pacientes'|'expedientes'|'responsables'|'consultas'|
  'diagnosticos'|'tratamientos'|'recetas'|'detalles',number>>;
 otherInstitution():Promise<ClinicalContext>;
 close():Promise<void>;
}
```

Counters/reset/otherInstitution are TEST-only factories, not production ports. reset uses disposable database/project per suite, never deletes real clinical data. Test factory adds logical institution 99 in the same test engine to prove isolation; production registry never accepts 99. No production fault-injection env variable or route. Repositories optionally receive an injected `afterWrite(point)` callback (default no-op) supplied only by test factories; this produces an actual exception after an actual persisted statement inside the native transaction.

**Unmodified suite case names and oracles (all 5 harnesses):**

1. `register_creates_patient_and_one_active_expediente` — ids positive, EXP number, null archive fields; count 1/1.
2. `duplicate_document_rolls_back_second_registration` — same doc with different tipo yields duplicate_document, counts unchanged.
3. `concurrent_duplicate_has_exactly_one_winner` — Promise.allSettled two creates; one success, one duplicate_document, one expediente.
4. `pediatric_requires_exactly_one_principal` — harness supports a pediatric context via factory argument, no/multiple principal fail; valid two guardians pass; expediente opens only after guardians.
5. `search_document_record_name_and_pagination` — three fake patients; literal name substring, exact doc/EXP, page size 1, deterministic total; q `%_.*` treated literally.
6. `foreign_institution_id_is_invisible` — same numeric ids possible, scoped list/find/archive/close never expose or modify other's data.
7. `register_failure_after_patient_rolls_back_every_row` — arm afterPaciente; create with guardians fails; all counts equal before.
8. `close_persists_complete_bundle` — 2 diagnoses/2 treatments/recipe with 2 medications; 1/2/2/1/2 added, correct FKs and null/default fields, complete history returned.
9. `close_without_recipe_is_atomic` — receta null, detalles []; consultation/diagnoses/treatments present.
10. `close_failure_after_diagnosis_rolls_back_every_child` — afterDiagnostico throws after first diagnosis insert; before/after counts identical; history empty.
11. `late_invalid_medication_rolls_back_bundle` — second medication id absent; reference_not_found; counts unchanged (real FK failure for SQL; transactional reference validation for documents).
12. `archive_preserves_history_and_patient_state` — archive retains consultation, paciente.estado activo, disappears active search, appears archived/todos.
13. `archive_twice_is_rejected` — already_archived, original reason/date unchanged.
14. `close_archived_is_rejected` — expediente_archived, counts unchanged.
15. `archive_close_race_serializes` — simultaneous close/archive: archive always succeeds once; if close succeeds history has one whole bundle, otherwise expediente_archived; no partial rows and no active expediente.
16. `uow_outer_failure_rolls_back_nested_success` — run transaction create + close then throw; counts equal before.
17. `returned_dto_mutation_does_not_change_storage` — mutate response name, refetch unchanged.

Harness `make` accepts `{kind?:InstitutionKind}` optional; default hospital_general, pediatric case constructs a second context using kind centro_pediatrico on the same test engine. This is test-only contract portability, not a production engine reassignment. All factory signatures are `make(options?:{kind?:InstitutionKind}):Promise<ClinicalHarness>`. Seed refs before each primary test context: municipio1, profesional1, CIE10 Z00.0, medicamentos1/2. A secondary institution99 in the same SQL database uses professional99 (SQL ids are global); fixture bundle builder reads each context catalog rather than assuming another institution owns professional1. No skips for missing engines in integration command; fail startup with clear required env message.

Runners `server/test/contracts/{memory,postgres,mysql,mongodb,firebase}.test.ts` call same suite. `server/vitest.config.ts` by default excludes non-memory runners, `src/adapters/{postgres,mysql,mongodb,firebase}/**/*.test.ts`, `test/seeds.test.ts`, `test/persistence.test.ts`, plus `server/test/security/**`; `TEST_ENGINES=1` includes them, with testTimeout 30000 and fileParallelism false for disposable DB setup. Exact red command: `npm run build -w @genki/shared && npm test -w @genki/server -- test/contracts/memory.test.ts`; engine commands prepend `TEST_ENGINES=1`. Missing exports/methods or failing behavior are expected red, never tests skipped. Freeze suite before adapters; any subsequent behavior change requires protocol-change with both owners' approval, not test weakening.

## C3.5 State transition tables

Each name is a Vitest case in `server/src/ports/auth.test.ts` (auth) or `server/src/application/archive-expediente.test.ts` / `close-consulta.test.ts` (clinical).

|State/event|Next|Result|Named test|
|---|---|---|---|
|anonymous/login correct active institution member|authenticated|tokens, PostgreSQL identity row read|auth_login_enters_session|
|anonymous/login wrong password, blocked user or wrong institution|anonymous|invalid_credentials|auth_bad_login_stays_anonymous|
|authenticated/me valid JWT+active user|authenticated|principal|auth_me_valid_session|
|authenticated/access expired or malformed/unknown kind/motor mismatch|refresh_needed|invalid_token|auth_bad_access_requires_refresh|
|refresh_needed/valid stored unrevoked refresh|authenticated|old revoked/new stored|auth_refresh_rotates_once|
|refresh_needed/replay old refresh or concurrent loser|anonymous|invalid_token|auth_refresh_replay_rejected|
|refresh_needed/expired refresh or disabled user|anonymous|invalid_token|auth_refresh_expired_rejected|
|authenticated/logout valid refresh|anonymous locally|204; stored refresh revoked|auth_logout_revokes_refresh|
|anonymous/logout same valid signed revoked refresh|anonymous|204|auth_logout_idempotent|
|any/logout bad/expired JWT|unchanged server, anonymous locally|401; client clears|auth_logout_bad_token_rejected|
|authenticated/another institution selected without new login|unchanged|ignore selector; requires new login|auth_cannot_switch_institution|
|absent/register valid|activo|patient+expediente atomic|register_opens_active_record|
|absent/register duplicate or invalid guardian|absent for attempted new record|409/422|register_invalid_does_not_open|
|activo/archive valid reason|archivado|history retained|archive_active_record|
|activo/archive invalid reason|activo|400|archive_invalid_reason_unchanged|
|archivado/archive again|archivado|409|archive_archived_record_rejected|
|absent or other institution/archive|unchanged|404|archive_unknown_record_rejected|
|activo/close valid clinical bundle|activo|closed consultation appended|close_on_active_record|
|activo/close invalid bundle or mid-write exception|activo|422 or rollback exception|close_failure_preserves_record|
|archivado/close|archivado|409|close_on_archived_record_rejected|
|archivado/reactivate|archivado|no route:404|reactivate_route_absent|

Session access claims remain EXACT locked set (shared/auth.ts), TTL 1800 seconds; refresh 1209600. HS256, verify explicit algorithms ['HS256']; verify all claim runtime types, allowed kind/id/motor mapping and current identity status. No Firebase ID-token substitution. Refresh jti = randomUUID, persist SHA-256(jti), not raw JWT. Rotate atomically with one winner; sessions persist across server restart. Logout revokes refresh, not access already issued (documented C1 bound).

## C3.6 Factory and test entrypoint signatures

Create `server/src/ports/adapter-resource.ts` (P2-01), exported by ports/index. No engine adapter imports config or another adapter; options carry drivers' configuration, types remain port-only.

```ts
export type PersistenceCheckpoint='afterPaciente'|'afterConsulta'|'afterDiagnostico';
export interface EngineAdapterSet extends ClinicalContext {readonly engine:DataEngine}
export interface AdapterResource {set:EngineAdapterSet;close():Promise<void>}
export interface EngineOptions {
 id_institucion:InstitutionId; kind:InstitutionKind; url:string; clock?:ClockPort;
 afterWrite?:(point:PersistenceCheckpoint)=>void;
}
export interface FirestoreOptions {
 id_institucion:InstitutionId; kind:InstitutionKind; projectId:string; emulatorHost:string;
 clock?:ClockPort; afterWrite?:(point:PersistenceCheckpoint)=>void;
}
// exact exports in each engine's index.ts
// async initialization checks connection; constructors scoped to supplied id/kind.
export function createPostgresAdapterSet(options:EngineOptions):Promise<AdapterResource>;
export function createMysqlAdapterSet(options:EngineOptions):Promise<AdapterResource>;
export function createMongoAdapterSet(options:EngineOptions):Promise<AdapterResource>;
export function createFirebaseAdapterSet(options:FirestoreOptions):Promise<AdapterResource>;
```

The existing config AdapterSet becomes `extends EngineAdapterSet`; registry caches `resource.set`, composition owns resource.close. ClinicalContext has clock/ids/UoW/pacientes/consultas/catalogos only, no engine label required by application. `FailurePoint` harness type aliases PersistenceCheckpoint. Checkpoints have no HTTP/env exposure; test constructors inject callback, normal config omits it.

Every `*.test.ts` introduced inside a physical engine folder is integration-only and discovered when TEST_ENGINES=1; memory/domain/application/HTTP remain default. Every test factory uses disposable `genki_test_<engine>_<suite>` DB or a `demo-test-genki-<suite>` Firestore project. Runtime seed uses `demo-genki-health`, so test resets never erase the demo. Native engines are not contacted merely by importing excluded factories during typecheck.

