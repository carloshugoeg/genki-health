# FS-06 — Gate de agenda (brief lane B)

## Variables del módulo

Sin cambios al `.env` global, seed global ni configuración de Firebase real-mode.
Exportar conexiones de bases locales de prueba, sin publicar sus credenciales:

- `AGENDA_POSTGRES_URL`: PostgreSQL 16, base local de pruebas.
- `AGENDA_MYSQL_URL`: MySQL 8.4, base local de pruebas; cliente UTC.
- `AGENDA_MONGODB_URL`: MongoDB 7, base local en replica set `rs0`.
- `FIRESTORE_EMULATOR_HOST`: loopback:puerto del emulador.
- `AGENDA_FIREBASE_PROJECT_ID`: proyecto demo, por defecto `demo-genki-agenda`.
- `TEST_AGENDA_ENGINES=1`: activa checks nativos de esta lane.
- `AGENDA_TEST_ENGINE`: opcional `postgres|mysql|mongodb|firebase` para ejecución secuencial.

## Migración y seed

Desde la raíz, con las variables anteriores exportadas y servicios listos:

```bash
npx tsx server/test/full/agenda/manage.ts migrate
npx tsx server/test/full/agenda/manage.ts seed
# Un solo motor, si se ejecutan servicios por separado:
npx tsx server/test/full/agenda/manage.ts migrate postgres
npx tsx server/test/full/agenda/manage.ts seed postgres
```

Los mismos subcomandos aceptan mysql/mongodb/firebase. La migración SQL crea
`agenda_cita` e índice; MySQL añade `agenda_lock` y `agenda_cita_id`.
Mongo crea índices de identidad y profesional/fecha; guardas/contador se crean
idempotentemente con su primer uso. Firestore es schemaless: no requiere DDL;
colecciones `instituciones/{id}/agenda_cita`, `agenda_lock` y contador `agenda_meta/cita`.
Seed: una cita ficticia id 900001 por institución asignada 1/2/3/4; no reemplaza
un registro ya existente. No es una operación de alta de pacientes/usuarios.

## Checks reproducibles

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run depcruise
npm run test:protocol
TEST_AGENDA_ENGINES=1 npm test -w @genki/server -- test/full/agenda/native.test.ts --testTimeout=60000
# Si el disco requiere un motor a la vez, repetir con cada motor:
TEST_AGENDA_ENGINES=1 AGENDA_TEST_ENGINE=postgres npm test -w @genki/server -- test/full/agenda/native.test.ts --testTimeout=60000
bash scripts/validate.sh
git diff --check
```

Por motor: contrato OP20–25, concurrencia, conflictos, cancelación conservando
registro, proyección segura, límites de Guatemala, relectura con repositorio nuevo,
fila/documento físico, rollback tras falla OP22 posterior a escritura y seed doble.
Los tests nativos migran dos veces; no usan memory ni omiten operaciones del motor.
El test opcional se omite en npm test ordinario y debe ejecutarse explícitamente
para reclamar persistencia. Los resultados finales quedan en el journal de la lane.

La UI se probó standalone con Chromium y un harness de contrato: agendar,
llegada, reprogramar, cancelar, disponibilidad, escritorio 1280 y móvil 390,
sin errores JS ni desbordamiento horizontal. No se presenta como UI integrada
con motores nativos ni como gate global de todo el full-system.

## Resultado del gate general

`VALIDATE_FULL=1 JOURNAL_GATE_BASE=7786ec4c52cb355c530a89f960010961a354fdb9 bash scripts/validate.sh`
pasa instalación, formato, lint, build shared, typecheck, depcruise y suites
(107 tests server + 8 web; los 20 nativos se ejecutan por separado).
La fase protocol da 37/38: falla exclusivamente `trackers_name_same_next_ticket`.
Se reprodujo el mismo fallo en un worktree limpio del SHA base: NOW nombra
E2-P2-07 y el test espera E2-P3A-02. No es una regresión de agenda. Los archivos
globales de trackers/tests quedan intactos por el alcance del brief.

`npm run build` (shared/server/web) y journal gate se ejecutaron aparte con éxito,
ya que validate aborta antes de llegar al build web. No se declara validate verde.

Persistencia final ejecutada secuencialmente: **PG 5/5, MySQL 5/5, Mongo 5/5,
Firestore 5/5**. Todos incluyen contrato OP20–25, prueba física y rollback.
CLI migrate + seed doble verificado en MongoDB; funciones de migración y seed
doble ejecutadas por las suites de cada uno de los cuatro motores.
