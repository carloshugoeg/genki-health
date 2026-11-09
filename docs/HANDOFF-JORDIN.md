# Handoff Genki Health MVP — para Jordin (Claude)

Fecha: 9 nov 2026 (hora Guatemala). Curso: Bases de Datos II, URL.

## 1. Repo y rama

- Repo: `github.com/carloshugoeg/genki-health`
- **Trabajá sobre `cursor/genki-ui-dashboard` (PR #62, draft).** Esta rama tiene todo: el stack #53→#61, el dashboard (#62) y el documento comparativo de la Entrega 2 (#63, ya mergeado adentro).
- No hagas merge a `main` ni force-push sin que Carlos lo apruebe.

```bash
git fetch origin cursor/genki-ui-dashboard
git checkout -B genki-ui-dashboard origin/cursor/genki-ui-dashboard
npm ci
```

## 2. Cómo correrlo local

1. `cp .env.example .env` y llená las contraseñas (pedíselas a Carlos; **nunca las subás**). Para Firestore real necesitás la cuenta de servicio del proyecto `genki-health-mvp08`: guardala fuera del repo o con nombre `*-firebase-adminsdk-*.json` (está en `.gitignore`) y apuntá `GOOGLE_APPLICATION_CREDENTIALS` a ella. `FIRESTORE_MODE=real`, `GENKI_MODE=engines`.
2. Motores en Docker, aislados (no tocan un Postgres 5433 ni un mongod 27017 que ya tengás):
   ```bash
   docker compose --env-file .env -p genki-mvp-20261108 -f infra/local-isolated/docker-compose.isolated.yml up -d
   # puertos: PG 55433, MySQL 33306, Mongo 37017 (volúmenes persistentes)
   ```
3. `npm run db:setup:all` (migra y siembra los 4 motores; se puede volver a correr).
4. `bash infra/local-isolated/start.sh` levanta API (http://127.0.0.1:3000) y web (http://localhost:5173). Los pid y logs quedan en `.local-runtime/`. Para apagar: `bash infra/local-isolated/stop.sh` (también baja los contenedores) o solo `kill $(cat .local-runtime/api.pid) $(cat .local-runtime/web.pid)`.

Usuarios de prueba (contraseña `admin123!`; tiene que quedarse así):
| N | Institución | Motor |
|---|---|---|
| 1 | hospital_general | PostgreSQL (también guarda auth) |
| 2 | centro_pediatrico | MySQL |
| 3 | laboratorio_clinico | MongoDB |
| 4 | clinica_odontologica | Firestore real |

`demo-N-administrador@example.invalid`, `demo-N-medico@example.invalid` y `superadmin@example.invalid`, que puede cambiar de institución desde /panel.

## 3. Arquitectura (resumen)

- Monorepo `server` (Fastify), `web` (React + Vite) y `shared` (DTOs).
- Arquitectura hexagonal: `server/src/domain` (reglas), `application` (casos de uso), `ports` y `adapters/{postgres,mysql,mongodb,firebase,http}`. Sin ORM: SQL y drivers nativos.
- Cada institución tiene su motor. El JWT lleva `institution_kind` e `id_institucion`, y `InstitutionAdapterRegistry.resolve()` elige los adaptadores. La UI es la misma para todos los motores.
- MongoDB y Firestore usan embed o reference según la decisión documentada en `docs/entregas/entrega-2/documento-comparativo.md`.

## 4. Lo que ya está

- Login, ruteo por usuario a su motor, superadmin con cambio de institución.
- Registro de paciente, búsqueda, historial, archivo y reactivación de expediente.
- Agenda: cita, reprogramación, llegada y cancelación.
- Alergias, antecedentes, consulta abierta con signos, y consulta cerrada atómica con diagnóstico, tratamiento y receta.
- Hospital: camas, ingreso, nota y egreso.
- Laboratorio: orden, muestra, resultado, validación y entrega.
- Usuarios: alta, reset de contraseña, cambio de contraseña, desactivación y bitácora.
- Lecturas económicas (insumos, tarifario, cuenta, cargos, caja).
- Dashboard con panel lateral; pacientes y profesionales se muestran con nombre + id.
- Persistencia real comprobada: datos creados, reinicio de API y de los 3 contenedores, datos intactos en los 4 motores (17/17).
- Aislamiento entre instituciones: 52/52 pruebas sin fuga. Eso cubre leer o buscar por id de otra institución, headers y query falsos, token manipulado, `alg=none`, endpoints de especialidad desde otra institución, y que un admin normal no pueda cambiar de institución.
- Se quitó el aviso falso "Vista de desarrollo: la persistencia depende…".
- Auditoría automatizada en `tests/e2e-audit/` (ver su README). Corrida de referencia: flujo 508/578, persistencia 17/17, web smoke sin errores de JS.

## 5. Pendientes, por prioridad

Cada hallazgo se reproduce con `node tests/e2e-audit/api-audit.mjs` (la salida de referencia está en `tests/e2e-audit/results/flow-20261109D.json`).

### P0: rompen flujos de la rúbrica o dan 500
1. **JSON malformado da 500 en todos los POST/PUT** (25 endpoints, incluido login). Repro: `curl -XPOST :3000/api/auth/login -H 'content-type: application/json' -d '{"a":'` → 500. Causa: `app.setErrorHandler` (server/src/adapters/http/app.ts) manda errores de Fastify con `statusCode` 4xx (FST_ERR_CTP_INVALID_JSON_BODY, media type) a `internal_error`. Fix: si `error.statusCode` está entre 400 y 499, devolver 400 `invalid_body` (o 415).
2. **Adjuntos rotos.** `POST /api/pacientes/:id/documentos` con JSON `{archivo_base64, tipo_mime:'application/pdf'}` siempre da 400, porque `parseDocumentJson` (full-routes.ts) crea un `Blob` sin nombre y el dominio exige `File.name`. Con multipart da 500 (no hay parser registrado). Tampoco hay UI de adjuntos. Fix: aceptar `nombre_archivo` y construir `new File([buf], nombre, {type})`; registrar `@fastify/multipart` o responder 415.
3. **Odontología no se puede usar con el demo.** `demo-4-medico` tiene rol `medico`, pero `DENTAL_ROLES = ['odontologo']`, así que odontograma, planes y saldo dental dan 403. Fix: sembrar `demo-4-odontologo@example.invalid` (rol `odontologo`, contraseña admin123!) o darle ese rol al médico demo 4, y probar odontograma → pieza → plan → aceptación → sesión.
4. **Pediatría en MySQL:** `POST /api/consultas/:id/mediciones` y `GET /api/pacientes/:id/crecimiento` dan 500. Repro: paciente pediátrico nuevo, consulta abierta, medición `{fecha_medicion, peso_kg, talla_cm, perimetro_cefalico_cm}`.
5. **`GET /api/bitacora?desde=zzz` da 500**: falta validar la query.

### P1: brechas funcionales o de rúbrica
6. **"Mantenimiento" de consultas, diagnósticos, tratamientos y recetas:** solo se pueden crear. No hay endpoint ni UI para editar o anular un diagnóstico, tratamiento o receta, ni para **cerrar una consulta abierta** (`/consultas/abiertas`). Una consulta abierta además bloquea archivar el expediente con un 409 genérico ("Conflicto de recurso"). Hay que agregar cierre de consulta abierta y edición/anulación con auditoría, y un mensaje claro en el 409.
7. **El catálogo CIE-10 está vacío y no se expone.** Cualquier `codigo_cie10` (p. ej. R51) da 422 `reference_not_found`; solo funciona `null`. Hay que sembrar un subconjunto de CIE-10 en los 4 motores y exponerlo en `/api/catalogos`.
8. **Vacunas:** el esquema de un paciente pediátrico nuevo viene vacío (no se generan dosis), así que no se puede aplicar una dosis ni registrar una reacción desde un flujo nuevo. `GET /api/vacunas/pendientes` sin parámetros da 400; hay que documentar o ajustar la query.
9. **La UI de especialidades tiene ids fijos:** `SpecialtyPanels.tsx` usa `/api/admisiones/1/notas`, `/api/admisiones/1/egreso`, `id_cama: 1` e `id_diagnostico_ingreso: 1`. Con datos reales eso da 404. Hay que usar la admisión, cama y diagnóstico del paciente.
10. **Procedimiento hospitalario:** `POST /api/procedimientos` no se validó; el cuerpo que probó la auditoría dio 400. Hay que revisar `parse` en `domain/full/procedure.ts` y la UI.
11. **Atribución:** `actorFrom()` (specialty-routes.ts y full-routes) fija `id_profesional = 1` para cualquier rol clínico. Debe salir del usuario (`usuario.id_profesional`).
12. **Rol administrador puede crear consulta + diagnóstico + receta** (`POST /api/pacientes/:id/consultas` permite `administrador`). Si la rúbrica pide separar lo clínico de lo administrativo, quitarle ese permiso.
13. **El administrador abre /pacientes/:id y la UI llama a la ficha, que le da 403** (error en consola). La UI debería ocultar esa sección según el rol.

### P2: seguridad y validación menores
14. El access token sigue siendo válido después de logout hasta que vence (JWT stateless, unos 30 min); el refresh sí se revoca. Documentarlo o agregar una denylist por `jti`.
15. Acepta una fecha de nacimiento futura (2099-01-01).
16. Un login con una contraseña incorrecta de menos de 8 caracteres responde 400 `password_policy` y revela la política. Debería responder 401 genérico.
17. Un cuerpo de más de 1 MB corta la conexión sin 413.

### Rúbrica y documentación
18. **Modelo de la Entrega I corregido:** falta aplicar las correcciones cuando llegue el feedback del profesor y reflejarlas en el DDL de los 4 motores y en el documento.
19. **Documento comparativo** (`docs/entregas/entrega-2/documento-comparativo.md/.pdf`): revisar que cubra modelado, consistencia y seguridad por motor más la justificación institución→motor. Agregar evidencia de las consultas equivalentes en los 4 motores y los resultados de esta auditoría.
20. **`db:setup:all`:** quedan restos de REVOKE/GRANT de PG que se arreglaron a mano. Hay que dejar el script idempotente y sin pasos manuales.
21. **Cifrado en reposo:** está diferido. Documentarlo como fuera de alcance o activarlo (p. ej. volúmenes cifrados, TDE de MySQL), con la justificación.

## 6. Estado de PRs y plan de merge

Todos son draft y nada está en `main`. El stack es lineal:
`codex/e2-p5-02…` ← #53 firestore-real-mode ← #54 superadmin ← #55 lane-1 ← #56 lane-2 ← #57 fixes-1 ← #58 integration ← #59 wire-ab ← #60 lane-3-users ← #61 fixes-2 ← #62 ui-dashboard (incluye #63).
También hay PRs viejos (#44–#52) de fases previas, ya cubiertos por este stack; cerrarlos después de confirmarlo.

Plan sugerido (con aprobación de Carlos):
1. Arreglar los P0 en `cursor/genki-ui-dashboard` y correr `npm run typecheck && npm test` y `tests/e2e-audit`.
2. Abrir un PR `cursor/genki-ui-dashboard → main` (squash o merge commit) en lugar de mergear 10 PRs uno por uno. Cerrar #53–#61 y #63 como "incluidos en #62".
3. Etiquetar `entrega-2` en el commit que se presente.

## 7. Reglas del proyecto

- No subir `.env`, la cuenta de servicio, keyfiles ni `.local-runtime/`.
- No usar servicios pagos ni hacer deploy a producción.
- La contraseña de los demos y del superadmin se queda en `admin123!`.

## 8. Estado tras los fixes (9 nov 2026, tarde)

Auditoría `2611091735`: flujo 566/579, 0 respuestas 5xx, aislamiento 52/52. Después de esa corrida se corrigieron vacunas (`id_profesional` desde el usuario) y la auditoría de odontología (usa `demo-4-odontologo`). Falta volver a correr esos 5 casos: Firestore real agotó la cuota diaria del plan gratuito (`RESOURCE_EXHAUSTED`), y mientras no se restablezca la API no arranca.

| # | Estado | Nota |
|---|---|---|
| 1 | Hecho | Errores 4xx de Fastify: 400 `invalid_body`, 413 `payload_too_large`, 415 `unsupported_media_type` |
| 2 | Hecho (parcial) | JSON con `nombre_archivo` → 201 en los 4 motores; multipart → 415; la UI permite subir. No hay endpoint para listar ni descargar documentos (requiere cambiar `ports/`) |
| 3 | Hecho | `demo-4-odontologo@example.invalid` (rol `odontologo`, contraseña `admin123!`) |
| 4 | Hecho | MySQL `growth.ts`: el alcance por institución pasa por `expediente → paciente`; `edad_meses` se calcula |
| 5 | Hecho | `desde`/`hasta` validados → 400 `invalid_query` |
| 6 | Hecho | `POST /api/consultas/:id/cierre`; `PATCH` y `POST …/anulacion` para diagnósticos, tratamientos y recetas, con bitácora; 409 `consulta_abierta` al archivar |
| 7 | Hecho | 56 códigos CIE-10 en los 4 motores, expuestos en `/api/catalogos` (`cie10`) |
| 8 | Hecho | El esquema MySQL genera las dosis al abrirse; `vacunas/pendientes` tiene parámetros opcionales (`hasta`, `page`, `page_size`) |
| 9 | Hecho (parcial) | Cama, admisión y diagnóstico salen de datos reales. No hay endpoint para listar admisiones; la UI recuerda la admisión activa |
| 10 | Hecho | `equipo` y `consumos` son opcionales; `id_profesional` sale del usuario |
| 11 | Hecho | `profesionalOf(principal)` busca `usuario.id_profesional` (caché de 60 s); el JWT no cambia |
| 12 | Pendiente (Carlos) | Cambia permisos por rol; la rúbrica no lo exige |
| 13 | Hecho | La ficha oculta secciones por rol; 0 respuestas 403 con 10 usuarios demo |
| 14 | Documentado | `docs/ARCHITECTURE.md`; la denylist requiere aprobación de cambio de auth |
| 15–17 | Hecho | Fecha de nacimiento futura → 400; login con contraseña incorrecta → 401 genérico; 413 en JSON |
| 18 | Pendiente | Esperando el feedback del profesor |
| 19, 21 | Hecho | Documento comparativo: consultas equivalentes en los 4 motores, cifrado en reposo fuera de alcance, resultados de la auditoría |
| 20 | Hecho | Las migraciones corren con la conexión admin; dos corridas seguidas de `db:setup:all` terminan limpias (~5.5 min) |

**Cambios de protocolo que revisan ambos dueños** (`AGENTS.md`):
- `ConsultationRepositoryPort` gana 5 métodos.
- Migraciones aditivas `full-05-01-clinical-maintenance.sql` (PG y MySQL), `full-13-vaccine-intervals.sql` (MySQL), y enums y `bitacora` en el validador de Mongo.
- GRANTs de columna nuevos.
- Filas ROL `enfermeria`, `laboratorista` y `odontologo`.
- Los usuarios demo clínicos quedan vinculados a `id_profesional = 1`.

Pendiente de decisión: el FK de `usuario.id_profesional` apunta a la tabla `profesional` de PostgreSQL (solo la institución 1). Para las instituciones 2–4, el id se refiere al profesional del motor de cada institución. Hay que decidir si se acepta así o se quita el FK.

**Tests:**
- Typecheck, lint, Prettier y depcruise limpios.
- Servidor: 182 pasan y 6 fallan. Son las suites `test/full/lane{1,2}*.persistence.test.ts`, que también fallan en `51acf26` por el arnés de entorno.
- Web: 21/21.
- repo-truth: 36/38; los mismos 2 fallos que en `51acf26`.
