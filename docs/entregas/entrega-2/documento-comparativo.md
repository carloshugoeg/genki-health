# Documento comparativo — Entrega II (Genki Health)

**Bases de Datos II — Universidad Rafael Landívar**  
**Integrantes:** Carlos Hugo Escobar Gómez · Héctor Jordin Adolfo García Coyoy  
**Evidencia:** rama `cursor/genki-fixes-2` · ADR-0001…0005 · `DECISIONS.md` · `docs/ARCHITECTURE.md` · contratos C4/C5 · `SCHEMA.md` · `SECURITY-FREE.md` · DDL y adaptadores en `server/src/adapters/`

---

## 1. Asignación institución → motor

Fijada en ADR-0002 y `shared/src/engines.ts` (`INSTITUTION_ENGINE_ASSIGNMENTS`). Cada motor se usa una sola vez.

| Institución | Motor | Volumen | Estructura | Transacciones estrictas |
| --- | --- | --- | --- | --- |
| Hospital general | **PostgreSQL** | Alto (citas, diagnósticos, tratamientos, hospitalización) | Relacional normalizado (C4a: `consulta` + tablas hijas, admisiones, procedimientos) | Máxima: el paquete consulta+diagnóstico+tratamiento no puede quedar a medias (Entrega I §1.1) |
| Centro médico pediátrico | **MySQL** | Consultas frecuentes y cortas; seguimiento longitudinal (años) | Datos estructurados y repetitivos (crecimiento, vacunas, hitos); esquema C4b InnoDB | Alta en cierre atómico de consulta y escrituras de seguimiento; segundo motor relacional distinto al hospital |
| Laboratorio clínico | **MongoDB** | Órdenes/resultados acumulables (cientos de exámenes por paciente) | Estructura **variable** (`RESULTADO.datos`: hematología ≠ orina ≠ cultivo; Entrega I §5.4) | Sesiones multi-documento en réplica `rs0`; resultados como documentos referenciados, no array ilimitado bajo el paciente |
| Clínica odontológica | **Firestore** | Bajo/medio; flujos cortos de secretaria | Documento natural para odontograma/superficies anidadas (Entrega I §5.5) | Transacciones Admin SDK; historial referenciado, no embebido sin límite |

Criterio (Entrega I §1.2): relacionales para información estable; documentales para esquema variable (lab) o anidación operativa (odontología).

---

## 2. Modelado por motor

### PostgreSQL (Hospital)
SQL a mano, sin ORM (ADR-0001, driver `pg`). Núcleo: paciente/expediente/consulta + `diagnostico` / `tratamiento` / `receta` / `detalle_receta`. Identidad y refresh sessions **solo** en este motor (ADR-0005). Extensiones de hospitalización en tablas propias.

### MySQL (Pediatría)
Mismo núcleo clínico en InnoDB (`mysql/migrations/`), tipos DATETIME/DECIMAL en el mapper. Responsables como filas separadas, creadas en la misma transacción de alta. Extensiones pediátricas (crecimiento, vacunas, hitos) viven aquí. Sin hashes de contraseña.

### MongoDB (Laboratorio) — embed vs referencia (ADR-0003, C5.1)

| | Decisión | Justificación |
| --- | --- | --- |
| **Embed** | En documento `consultas`: `diagnosticos[]`, `tratamientos[]`, `receta`+`detalles[]` (≤256 KiB UTF-8) | Un paquete clínico atómico y acotado (1–10 dx, 1–20 tx, 0–20 detalles) |
| **Referencia** | Consultas **no** se embeben en paciente/expediente | Historial unbounded |
| **Referencia** | Catálogos por id entero; `responsables` colección aparte (alta multi-doc con rollback) | Sin FK nativas; prueba de transacción |
| **Referencia** | `ordenes_examen` + `resultados` (`full/lab-results.ts`); `datos` variable ligado a la orden | Un paciente acumula cientos de exámenes → no embeber bajo paciente |

`_id` = `<institution>:<numeric id>`; validadores `$jsonSchema` en `mongodb/schema.ts`.

### Firestore (Odontología) — embed vs referencia (ADR-0004, C5.2)

| | Decisión | Justificación |
| --- | --- | --- |
| **Embed** | En `consultations/{id}`: mismos arrays clínicos (≤256 KiB; margen bajo 1 MiB) | Mismo bundle atómico |
| **Referencia** | Colecciones hijas bajo `institutions/{id}`: patients, records, consultations… | Historial unbounded |
| **Referencia** | Unicidad de documento vía `documentKeys/{sha256}` en la tx de alta | El número puede contener `/` |
| **Embed acotado** | Líneas de plan / superficies dentales con techos (SCHEMA.md) | Coincide con el odontograma en papel; sesiones se referencian |

React no usa el SDK de Firestore; solo Admin en el backend.

---

## 3. Consistencia (registrar consulta + diagnóstico + receta)

Caso de uso compartido: `closeConsulta` (`application/close-consulta.ts`). Misma regla en los cuatro motores: **todo el bundle o nada**.

| Motor | Mecanismo | Evidencia en código |
| --- | --- | --- |
| **PostgreSQL** | `BEGIN ISOLATION LEVEL READ COMMITTED` → `COMMIT` / `ROLLBACK` | `postgres/unit-of-work.ts`; `PostgresConsultaRepository` inserta `consulta` → `diagnostico` → `tratamiento` → `receta`/`detalle_receta` dentro de `runInTransaction` |
| **MySQL** | Isolation READ COMMITTED + `BEGIN`/`COMMIT`/`ROLLBACK` | `mysql/unit-of-work.ts`; mismo grafo INSERT en `MysqlConsultaRepository` con bloqueo de expediente |
| **MongoDB** | `startSession` + `withTransaction` (`readConcern: snapshot`, `writeConcern: majority`), ≤3 reintentos | `mongodb/unit-of-work.ts`; un `insertOne` de consulta **con** dx/tx/receta embebidos tras validar referencias en sesión |
| **Firestore** | `db.runTransaction` (Admin); lecturas antes de escrituras; ≤3 intentos | `firebase/unit-of-work.ts` + `consulta-repository.ts` (`set` del documento `consultations/{id}` con bundle) |

Suite de contrato C3.4 exige rollback nativo (p. ej. medicamento inválido no deja consulta parcial).

---

## 4. Seguridad por motor

Clasificación (Entrega I §9 / ADR-0005 / C5.3): **pública** (catálogos, nombres de institución), **confidencial** (identidad/contacto paciente, estado de expediente), **restringida** (contenido clínico; hashes/JTI). Campo no clasificado → restringido. Roles API MVP: `administrador`, `recepcion`, `medico`, `auditor`. Auth: email+password, Argon2id, JWT access+refresh; SoR en Hospital PG.

| Motor | Aplicación de seguridad |
| --- | --- |
| **PostgreSQL** | Roles NOLOGIN `genki_app` / `genki_identity` / `genki_report` (`postgres/security.sql`). `REVOKE ALL FROM PUBLIC`. App: SELECT catálogos; SELECT/INSERT clínico; UPDATE acotado a expediente/contadores. Identity toca `usuario`/`auth_session`, no clínico. Report: solo vista agregada. DSN runtime ≠ dueño de migración. |
| **MySQL** | Roles `genki_app` / `genki_report` (`mysql/security.sql`); vista DEFINER; runtime ≠ root; alcance por institución en repositorio; denegaciones nativas en `test/security/mysql.test.ts`. |
| **MongoDB** | Roles `genkiApp` / `genkiReporter` (`mongodb/security.ts`): find/insert clínico, update expediente/counters; reporter solo vista; sin remove/drop/bypassDocumentValidation; auth + keyfile rs0. |
| **Firestore** | Reglas deny-by-default (`infra/firebase/firestore.rules`); solo reporter lee `reportes`. Admin SDK bypasea reglas → seguridad efectiva = JWT HTTP + puertos scoped a institución 4 (no se afirma que las reglas protejan Admin). |

Seeds: contraseñas solo desde `SEED_PASSWORD` (env). Sin afirmación de TLS/cifrado en reposo de emuladores locales (ADR-0005).

---

## 5. Hexágono y enrutamiento

Arquitectura hexagonal (ADR-0001, `ARCHITECTURE.md`): `application/` y `domain/` dependen de **puertos**; cada motor es un adaptador (`postgres` \| `mysql` \| `mongodb` \| `firebase`). Sin ORM.

Al autenticarse, el JWT lleva `institucion_id`, `institucion_kind` y `motor`; el registro (`compose-engines` / adapter registry) elige el `AdapterSet`. Las mismas rutas REST y la misma UI React/Vite sirven las cuatro instituciones: cambian los adaptadores, no las reglas de negocio ni la interfaz. El superadministrador de evaluación puede seleccionar institución y recibir un JWT reemitido.

---

## Referencias rápidas

| Tema | Ruta |
| --- | --- |
| Asignación | `docs/specs/adr/ADR-0002-institution-engines.md`, `shared/src/engines.ts` |
| Aggregates | `ADR-0003`, `ADR-0004`, `docs/plan/contracts/DOCUMENTS-SECURITY.md` |
| Seguridad | `ADR-0005`, `SECURITY-FREE.md`, `*/security.sql`, `mongodb/security.ts`, `firestore.rules` |
| Transacciones | `*/unit-of-work.ts`, `*/consulta-repository.ts`, `application/close-consulta.ts` |
| Resultados lab | `adapters/mongodb/full/lab-results.ts`, `schema.json` |

---

## 6. Equivalencia de operaciones y límites de evidencia

Las operaciones nucleares de historial —buscar/registrar paciente, archivar, cerrar consulta con diagnóstico/tratamiento/receta— se exponen por la misma API y se ejecutan de forma equivalente en los cuatro adaptadores (contrato C3 / suite C3.4). Especialidades se montan en el motor asignado (hospitalización en PG, pediatría en MySQL, laboratorio en Mongo, odontología en Firestore; ver `docs/ARCHITECTURE.md` lanes 1–2).

**Límites explícitos (no inventados en este documento):**

- Cifrado en reposo / field-level encryption: aspiración §9.5 documentada como diferida en ADR-0005; no se afirma implementación en emuladores locales.
- Las reglas de Firestore no aseguran el Admin SDK; la seguridad clínica odontológica depende del backend JWT.
- El documento comparativo describe decisiones de modelado/consistencia/seguridad presentes en ADRs, contratos y código de adaptadores de `cursor/genki-fixes-2`; no sustituye capturas de UI ni el checklist de demostración oral.

*Documento breve de Entrega II. No afirma despliegue productivo.*
