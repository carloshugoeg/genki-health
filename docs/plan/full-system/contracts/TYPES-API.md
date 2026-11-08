# F2 — Additive DTO, validation, route/error contract

Normative with per-operation contracts below. Future repo path `docs/plan/full-system/contracts/TYPES-API.md`. Existing `@genki/shared` DTOs, integer brands, errors and 17 C3.4 cases remain intact. No renamed baseline fields. Only FULL-FOUNDATION owns shared export-map/index and full error aliases. New per-module types import via `@genki/shared/full/<module>`; foundation adds package export pattern `./full/*` mapping to dist/full/*.js and *.d.ts. No module writes `shared/src/index.ts`.

## Validation rules
IDs positive signed int32; BIGINT audit id decimal string; strict objects recursively reject unknown keys (400 invalid_body), strict query (400 invalid_query). Timestamps ISO UTC Z; source DATE YYYY-MM-DD; UI Guatemala UTC-6. Text trimmed nonempty and maximum source VARCHAR length, TEXT max 10000; request strings cannot contain NUL. Source domain enums/ranges in `entities.json` are normative, except explicitly retained baseline enums/widths in API.md/C4 prevail for already existing fields. Source projections below determine exactly writable fields; server derives PK, principal institution, timestamp, actor, state and route parent. Optional source fields accept null; no implicit mass assignment. No body can set `id_institucion`, role, calculated monetary fields or creator except explicit administrator role operation. Parent id from route is authorized/scoped before use. All new mutation requests include `Idempotency-Key` 1..80 chars, replay same operation/hash returns stored response, different payload =>409 conflict; stored atomically in same target store. expected_revision where stated is nonnegative integer in body; stale=>409 conflict.

GET responses 200; creates POST 201; commands POST 200; password change/logout204; malformed400; no principal401 missing_bearer/invalid_token; wrong operation role403 forbidden; missing/foreign resource404 not_found; invalid domain422 invalid_bundle/reference_not_found; state/duplicate/stock/overpay409 conflict; engine unavailable503 store_unavailable; unexpected500 internal_error. Retain more specific baseline codes duplicate_document/guardian_required/invalid_guardians/expediente_archived/already_archived. No new ErrorCode is needed: extend Spanish safe messages by existing code, not new catalog entries. No driver/raw clinical body in logs.

`PageQuery={page?:number=1,page_size?:number=20<=50}`. `Page<T>={items:T[],page:number,page_size:number,total:number}`, stable id ascending unless per-op order specifies otherwise. `JsonValue` is only used for explicitly documented bounded discriminated result/plan/draft bodies, never an unrestricted request blob. Date/decimal/enum constraints must be enforced in Zod and domain as well as native SQL/document validators. Route methods below are not permission to add production routes in this architecture run.

## Exact request projection aliases

- `Input<CONTACTO_EMERGENCIA> = { nombre_completo:string; parentesco:string; telefono:string; telefono_alterno?:string | null; es_principal:boolean }`. Parent, actor and generated fields are server-owned.

- `Input<ANTECEDENTE> = { tipo:string; descripcion:string; fecha_inicio?:string | null; vigente:boolean }`. Parent, actor and generated fields are server-owned.

- `Input<ALERGIA> = { sustancia:string; tipo:string; severidad:string; reaccion?:string | null; fecha_deteccion?:string | null }`. Parent, actor and generated fields are server-owned.

- `Input<CITA> = { id_paciente:number; id_profesional:number; id_especialidad?:number | null; fecha_hora:string; duracion_minutos:number; motivo?:string | null }`. Parent, actor and generated fields are server-owned.

- `Input<SIGNOS_VITALES> = { presion_sistolica?:number | null; presion_diastolica?:number | null; frecuencia_cardiaca?:number | null; frecuencia_respiratoria?:number | null; temperatura_c?:number | null; saturacion_oxigeno?:number | null; peso_kg?:number | null; talla_cm?:number | null }`. Parent, actor and generated fields are server-owned.

- `Input<ADMISION> = { id_consulta_origen?:number | null; id_cama:number; tipo_ingreso:string; fecha_hora_ingreso:string; id_diagnostico_ingreso:number }`. Parent, actor and generated fields are server-owned.

- `Input<NOTA_EVOLUCION> = { contenido:string; turno?:string | null; id_nota_anterior?:number | null }`. Parent, actor and generated fields are server-owned.

- `Input<ORDEN_ESTUDIO> = { id_institucion_destino:number; tipo_examen:string; prioridad:string; indicaciones?:string | null }`. Parent, actor and generated fields are server-owned.

- `Input<ANTECEDENTE_PERINATAL> = { semanas_gestacion?:number | null; tipo_parto?:string | null; peso_nacimiento_g?:number | null; talla_nacimiento_cm?:number | null; apgar_1min?:number | null; apgar_5min?:number | null; complicaciones?:string | null }`. Parent, actor and generated fields are server-owned.

- `Input<CONSUMO_INSUMO> = { id_insumo:number; id_admision?:number | null; id_procedimiento?:number | null; id_consulta?:number | null; cantidad:number; lote?:string | null; id_profesional_registra:number }`. Parent, actor and generated fields are server-owned.

- `Input<PARTICIPACION> = { id_profesional:number; codigo_rol:string; id_consulta?:number | null; id_procedimiento?:number | null; fecha_hora_inicio:string; fecha_hora_fin?:string | null; observacion?:string | null }`. Parent, actor and generated fields are server-owned.

- `Input<TARIFA_HONORARIO> = { codigo_servicio:string; modalidad:string; monto_fijo?:string | null; porcentaje?:string | null; vigente_desde:string }`. Parent, actor and generated fields are server-owned.

- `Input<SEGUIMIENTO_HITO> = { alcanzado:boolean; fecha_evaluacion:string; observacion?:string | null }`. Parent, actor and generated fields are server-owned.

- `Input<MUESTRA> = { codigo_barras:string; tipo_muestra:string; fecha_hora_toma:string; condicion:string; responsable_toma:number }`. Parent, actor and generated fields are server-owned.

## Composite request / response aliases

```ts
// Specification only; shared/src/full/<module>.ts owns its relevant declarations.
type UsuarioAdminInput = {action:'create'|'update'|'deactivate'; id?:number; nombre_usuario?:string; correo?:string; id_profesional?:number|null; rol?:string; estado?:'activo'|'bloqueado'|'inactivo';vinculo_paciente?:{id_paciente:number};vinculo_profesional?:{id_profesional:number}};
// create requires nombre_usuario,correo,rol; update requires id and >=1 changed field;
// create yields generated temporary password once alongside UsuarioPublico, never persistent cleartext.
type UsuarioAdminResult = {usuario:UsuarioPublico;temporal?:string}; // temporary only for create/reset response, never subsequent reads
type UsuarioPublico = {id_usuario:number;id_institucion:number;id_profesional:number|null;nombre_usuario:string;correo:string;rol:string;estado:string};
type AuditQuery = PageQuery & {desde?:string;hasta?:string;entidad?:string;id_registro?:string;id_usuario?:number};
type BitacoraSafe = {id_bitacora:string;id_usuario:number;entidad:string;id_registro:string;accion:string;fecha_hora:string;detalle:{campos:string[];op:number;resultado:string}};
type PacientePatch = Partial<Omit<RegisterPacienteRequest,'responsables'>>; // >=1 field, retain baseline validation
// Input envelope for existing baseline patient fields remains unchanged.
type FichaCompleta = {paciente:PacienteDto;expediente:ExpedienteDto;alergias:ALERGIA[];antecedentes:ANTECEDENTE[];contactos:CONTACTO_EMERGENCIA[]};
type HistoryEvent = {tipo:'consulta'|'documento'|'admision'|'nota'|'procedimiento'|'perinatal'|'medicion'|'vacuna'|'hito'|'examen'|'odontograma'|'plan'|'sesion';id:number;fecha_hora:string;datos:TypedHistoryPayload};
// TypedHistoryPayload is a closed discriminated union of the corresponding entity DTOs, never `any`.
type Slot = {id_profesional:number;inicio:string;fin:string};
type OpenConsultaInput = {id_profesional:number;id_cita?:number|null;tipo:'primera_vez'|'seguimiento'|'emergencia';motivo_consulta:string;fecha_hora_inicio:string};
type FullConsultaDto = Omit<ConsultaDto,'estado'|'tipo'> & {estado:'abierta'|'cerrada'|'anulada';tipo:'primera_vez'|'seguimiento'|'emergencia'};
type ConsultaDraft = {consulta:FullConsultaDto;revision:number;diagnosticos:DiagnosticoInput[];tratamientos:TratamientoInput[];receta:CloseConsultaRequest['receta']|null};
// Additive FullConsultaDto permits abierta/anulada and nullable fin; baseline ConsultaDto is not narrowed/rewritten.
type ActRef = {id_consulta?:number;id_procedimiento?:number}; // exactly one
// Nested bundle writes happen in a single local UoW, no outbound HTTP callback.
type ProcedimientoBundle = {id_admision?:number;id_consulta?:number;codigo_procedimiento:string;id_profesional:number;fecha_hora:string;sala?:string;hallazgos?:string;complicaciones?:string;equipo:Input<PARTICIPACION>[];consumos:Input<CONSUMO_INSUMO>[]};
type MedicionInput = {fecha_medicion:string;peso_kg:number;talla_cm:number;perimetro_cefalico_cm?:number};
type DosisSchedule = DOSIS_VACUNA & {atrasada:boolean;version_esquema:string};
type DosisPendiente = DosisSchedule & {id_paciente:number;nombre:string;telefono:string|null};
type LabOrderInput = {id_paciente:number;institucion_origen:number;medico_solicitante:string;prioridad:'rutina'|'urgente';examenes:string[];observaciones?:string;referencia_externa?:string};
// `institucion_origen` is a referral descriptor ONLY, NOT storage routing; explicit referral policy validates origin.
type ResultadoInput = {codigo_examen:string;id_muestra:number;datos:ResultadoDatos;observaciones?:string};
type ResultadoFlags = {id_resultado:number;analitos:{nombre:string;valor:number;unidad:string;min:number;max:number;fuera_rango:boolean;referencia_version:string}[]};
type LabHistory = {orden:ORDEN_EXAMEN;muestras:MUESTRA[];resultados:RESULTADO[]};
type PiezaPatch = {estado:'sana'|'caries'|'obturada'|'ausente'|'corona'|'implante'|'endodoncia';superficies:Partial<Record<'mesial'|'distal'|'vestibular'|'lingual'|'oclusal','sana'|'caries'|'obturada'|'corona'|'endodoncia'>>;movilidad:0|1|2|3;observacion?:string;expected_revision:number};
type PlanInput = {id_profesional:number;detalle:{linea:number;numero_pieza:number;codigo_procedimiento:string;orden:number;precio_unitario:string}[]};
// Every price checked against snapshot reference catalog, not accepted as arbitrary client price. Max100 unique line ids.
type SesionInput = {id_cita?:number;fecha:string;lineas:number[];anestesia_utilizada?:string;observaciones?:string;expected_revision:number};
type DentalBalance = {presupuesto:string;ejecutado:string;facturado:string;pagado:string;pendiente:string};
type PersonalInput = {action:'create'|'update'|'deactivate';id_profesional?:number;nombres?:string;apellidos?:string;id_especialidad?:number|null;numero_colegiado?:string|null;telefono?:string|null;correo?:string|null;id_tipo_personal?:number;modalidad_contrato?:'planilla'|'honorarios'|'externo';fecha_ingreso?:string};
// create requires names, category, contract and start; other actions require id; locked B profesional stays unchanged.
type PersonalDto = {profesional:PROFESIONAL;contrato:PROFESIONAL_CONTRATO};
type Liquidacion = {id_profesional:number;periodo:string;actos:{id_participacion:number;codigo_rol:string;honorario:string}[];total:string};
type CargoInput = {id_paciente:number;codigo_servicio:string;origen:'manual'|'consulta'|'procedimiento'|'estancia'|'insumo'|'honorario'|'examen';id_consulta?:number;id_procedimiento?:number;id_admision?:number;id_consumo?:number;id_participacion?:number;cantidad:string;clave_evento:string};
// Nonmanual origin only internal application writer, HTTP accepts manual. Unit price/description derived from tariff.
type CargoCaja = {id_cargo:number;descripcion:string;cantidad:string;precio_unitario:string;subtotal:string;estado:string};
type InvoicePreview = {cargos:CargoCaja[];subtotal:string;impuesto:string;total:string;preview_hash:string};
type FacturaInput = {cargo_ids:number[];serie:string;nombre_receptor:string;nit_receptor:string;descuento?:string;cobertura_seguro?:string;preview_hash:string};
type PagoInput = {monto:string;metodo:'efectivo'|'tarjeta'|'transferencia'|'seguro';referencia?:string};
type FacturaCompleta = {factura:FACTURA;lineas:DETALLE_FACTURA[];pagos:PAGO[]}; // Caja DTO excludes clinical FKs; original entity remains native storage only.
type EstadoCuenta = {facturas:FacturaCompleta[];total:string;pagado:string;saldo:string};
type CierreCaja = {fecha:string;por_metodo:{metodo:string;monto:string;anulado:string}[];total:string};
```

Lab result discriminated payload (`tipo` must equal catalog exam type):
- hematologia: numeric hemoglobina,hematocrito,leucocitos,plaquetas,eritrocitos,VCM,HCM; `diferencial` numeric neutrofilos,linfocitos,monocitos,eosinofilos,basofilos, each0..100 and sum100±0.1.
- orina: strings color,aspecto; numeric densidad,pH(0..14); boolean proteinas,glucosa,cetonas,nitritos; `sedimento` strings leucocitos,eritrocitos,celulas_epiteliales,bacterias,cristales.
- cultivo: microorganismo:string,recuento_colonias:number>=0,tipo_medio:string,antibiograma array1..100 of {antibiotico:string,sensibilidad:'sensible'|'intermedio'|'resistente',cmi:number>=0}; antibiotic unique.
- quimica: analitos array1..100 of {nombre:string,valor:number,unidad:string}; names unique and configured for exam. Negative only if reference/catalog expressly allows, otherwise >=0.
- serologia: analytes array1..100 of {nombre:string,resultado:'positivo'|'negativo'|'indeterminado',valor?:number,unidad?:string}; numeric values require matching reference. This shape is a declared delta design because source lists serologia type without its fields.
All numbers finite. No unknown exam/analytical key. Result snapshot holds flag+reference values for every numeric analyte; missing quantitative reference fails422 instead of fake-normal. Qualitative entries explicitly not numeric-range evaluated.

## OP-01 — Iniciar sesión
- Source: [§10 L2725](../source/analisis-y-modelo-relacional.md#L2725); Inst. **HPLO**. Owner module `account`.
- `POST /api/auth/login`; request `LoginRequestDto`; response `AuthTokensDto`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_credentials` plus common401/403/404/400/503; all failures leave state unchanged.
- Retain JWT; five failed attempts block account; verify current persisted status on every request.

## OP-02 — Cerrar sesión
- Source: [§10 L2728](../source/analisis-y-modelo-relacional.md#L2728); Inst. **HPLO**. Owner module `account`.
- `POST /api/auth/logout`; request `refresh_token:string`; response `void`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_token` plus common401/403/404/400/503; all failures leave state unchanged.
- Retain 204 and idempotent signed revoked token; add logout timestamp audit, never log token.

## OP-03 — Cambiar contraseña
- Source: [§10 L2731](../source/analisis-y-modelo-relacional.md#L2731); Inst. **HPLO**. Owner module `account`.
- `POST /api/auth/password`; request `anterior:string,nueva:string`; response `void`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_credentials` plus common401/403/404/400/503; all failures leave state unchanged.
- Verify previous Argon2id; policy >=12 chars <=200, at least one letter and digit; revoke all refresh sessions atomically with password update.

## OP-04 — Restablecer contraseña
- Source: [§10 L2734](../source/analisis-y-modelo-relacional.md#L2734); Inst. **HPLO**. Owner module `account`.
- `POST /api/usuarios/:id/reset-password`; request `none`; response `temporal:string`; status policy above (baseline endpoints unchanged).
- Named domain error `not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Admin only; CSPRNG 24-char temporary password shown once, never audit; must change before clinical access; revoke sessions, clear failed counter.

## OP-05 — Administrar usuarios y roles
- Source: [§10 L2737](../source/analisis-y-modelo-relacional.md#L2737); Inst. **HPLO**. Owner module `users`.
- `POST /api/usuarios`; request `UsuarioAdminInput`; response `UsuarioAdminResult`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Create/update/deactivate through explicit action upsert with optional id; role allowlist; may not deactivate last active administrator; no password/hash in DTO.

## OP-06 — Consultar bitácora
- Source: [§10 L2740](../source/analisis-y-modelo-relacional.md#L2740); Inst. **HPLO**. Owner module `users`.
- `GET /api/bitacora`; request `AuditQuery`; response `Page<BitacoraSafe>`; status policy above (baseline endpoints unchanged).
- Named domain error `forbidden` plus common401/403/404/400/503; all failures leave state unchanged.
- Admin/auditor only; stable time/id paging; append-only; restricted reads/writes audited without clinical content.

## OP-07 — Buscar paciente
- Source: [§10 L2746](../source/analisis-y-modelo-relacional.md#L2746); Inst. **HPLO**. Owner module `patient`.
- `GET /api/pacientes`; request `SearchPacientesInput`; response `PacientePage`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_query` plus common401/403/404/400/503; all failures leave state unchanged.
- Preserve baseline literal search, active filter, scoped document uniqueness.

## OP-08 — Registrar paciente nuevo
- Source: [§10 L2749](../source/analisis-y-modelo-relacional.md#L2749); Inst. **HPLO**. Owner module `patient`.
- `POST /api/pacientes`; request `RegisterPacienteRequest`; response `PacienteResumen`; status policy above (baseline endpoints unchanged).
- Named domain error `duplicate_document` plus common401/403/404/400/503; all failures leave state unchanged.
- Preserve atomic patient+expediente+required guardian.

## OP-09 — Actualizar datos del paciente
- Source: [§10 L2752](../source/analisis-y-modelo-relacional.md#L2752); Inst. **HPLO**. Owner module `patient`.
- `PATCH /api/pacientes/:id`; request `PacientePatch`; response `PacienteResumen`; status policy above (baseline endpoints unchanged).
- Named domain error `duplicate_document` plus common401/403/404/400/503; all failures leave state unchanged.
- Allow identity/contact edits except generated ids, institution, state and registration time; validate document uniqueness and no future birth; return only identity to reception.

## OP-10 — Registrar contacto de emergencia
- Source: [§10 L2755](../source/analisis-y-modelo-relacional.md#L2755); Inst. **HPLO**. Owner module `patient`.
- `POST /api/pacientes/:id/contactos`; request `Input<CONTACTO_EMERGENCIA>`; response `CONTACTO_EMERGENCIA`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Atomic replace principal flag on other contacts when adding a new principal; validate ownership.

## OP-11 — Registrar responsable o tutor
- Source: [§10 L2758](../source/analisis-y-modelo-relacional.md#L2758); Inst. **P**. Owner module `patient`.
- `POST /api/pacientes`; request `RegisterPacienteRequest.responsables`; response `PacienteResumen`; status policy above (baseline endpoints unchanged).
- Named domain error `guardian_required` plus common401/403/404/400/503; all failures leave state unchanged.
- Keep inline atomic registration, not a new orphan patient workflow; later guardian addition uses contacts-style child write while exactly one principal remains.

## OP-12 — Consultar ficha del paciente
- Source: [§10 L2761](../source/analisis-y-modelo-relacional.md#L2761); Inst. **HPLO**. Owner module `record`.
- `GET /api/pacientes/:id/ficha`; request `none`; response `FichaCompleta`; status policy above (baseline endpoints unchanged).
- Named domain error `not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Clinical role sees identity+allergies+antecedents, reception gets only baseline identity; never grant reception clinical field access.

## OP-13 — Abrir expediente
- Source: [§10 L2767](../source/analisis-y-modelo-relacional.md#L2767); Inst. **HPLO**. Owner module `patient`.
- `POST /api/pacientes`; request `RegisterPacienteRequest`; response `PacienteResumen`; status policy above (baseline endpoints unchanged).
- Named domain error `duplicate_document` plus common401/403/404/400/503; all failures leave state unchanged.
- Retain registration transaction and one record per patient; not a second opening route.

## OP-14 — Consultar historial completo
- Source: [§10 L2770](../source/analisis-y-modelo-relacional.md#L2770); Inst. **HPLO**. Owner module `history`.
- `GET /api/pacientes/:id/historial`; request `PageQuery`; response `Page<HistoryEvent>`; status policy above (baseline endpoints unchanged).
- Named domain error `not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Merge all local clinical events including specialty, attachments, admissions, notes, exams, dental, growth and vaccines; timestamp desc then type then id; bridge results only after delivery.

## OP-15 — Registrar antecedentes
- Source: [§10 L2774](../source/analisis-y-modelo-relacional.md#L2774); Inst. **HPLO**. Owner module `record`.
- `POST /api/pacientes/:id/antecedentes`; request `Input<ANTECEDENTE>`; response `ANTECEDENTE`; status policy above (baseline endpoints unchanged).
- Named domain error `expediente_archived` plus common401/403/404/400/503; all failures leave state unchanged.
- Append, source types personal/familiar/quirurgico/habito; no future start date; no clinical DELETE.

## OP-16 — Registrar alergia
- Source: [§10 L2779](../source/analisis-y-modelo-relacional.md#L2779); Inst. **HPLO**. Owner module `record`.
- `POST /api/pacientes/:id/alergias`; request `Input<ALERGIA>`; response `ALERGIA`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Unique normalized substance per expediente; severity leve/moderada/severa, reference rules from schema.

## OP-17 — Adjuntar documento
- Source: [§10 L2782](../source/analisis-y-modelo-relacional.md#L2782); Inst. **HPLO**. Owner module `attachments`.
- `POST /api/pacientes/:id/documentos`; request `multipart archivo plus optional id_consulta`; response `DOCUMENTO_ADJUNTO`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_body` plus common401/403/404/400/503; all failures leave state unchanged.
- PDF/JPEG/PNG magic and MIME, max 10MiB, stream SHA256, generated local path; authorized download GET /api/documentos/:id/contenido; cleanup orphan temp files on failure.

## OP-18 — Archivar expediente
- Source: [§10 L2785](../source/analisis-y-modelo-relacional.md#L2785); Inst. **HPLO**. Owner module `record`.
- `POST /api/pacientes/:id/archivo`; request `ArchiveRequest`; response `ExpedienteDto`; status policy above (baseline endpoints unchanged).
- Named domain error `already_archived` plus common401/403/404/400/503; all failures leave state unchanged.
- Keep archive behavior; reject active admissions or open consultations with conflict instead of corrupting state.

## OP-19 — Reactivar expediente
- Source: [§10 L2788](../source/analisis-y-modelo-relacional.md#L2788); Inst. **HPLO**. Owner module `record`.
- `POST /api/pacientes/:id/reactivacion`; request `motivo:string`; response `ExpedienteDto`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Administrator only; clear archive metadata but append old values to safe audit; never erase history.

## OP-20 — Consultar disponibilidad
- Source: [§10 L2794](../source/analisis-y-modelo-relacional.md#L2794); Inst. **HPO**. Owner module `agenda`.
- `GET /api/agenda/disponibilidad`; request `id_profesional:id,desde:iso,hasta:iso`; response `Slot[]`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_query` plus common401/403/404/400/503; all failures leave state unchanged.
- UTC intervals, <=31 days; 08:00-17:00 Guatemala Mon-Sat, 30min default; explicit academic configurable hours not claimed source fact.

## OP-21 — Agendar cita
- Source: [§10 L2797](../source/analisis-y-modelo-relacional.md#L2797); Inst. **HPLO**. Owner module `agenda`.
- `POST /api/citas`; request `Input<CITA>`; response `CITA`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Lock scoped professional/day; reject overlapping non-cancelled/non-no_asistio intervals, not only identical start.

## OP-22 — Reprogramar cita
- Source: [§10 L2800](../source/analisis-y-modelo-relacional.md#L2800); Inst. **HPLO**. Owner module `agenda`.
- `POST /api/citas/:id/reprogramacion`; request `fecha_hora:iso,duracion_minutos:int`; response `CITA`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Release prior and reserve new interval atomically; injected mid-write failure restores old slot.

## OP-23 — Cancelar cita
- Source: [§10 L2803](../source/analisis-y-modelo-relacional.md#L2803); Inst. **HPLO**. Owner module `agenda`.
- `POST /api/citas/:id/cancelacion`; request `motivo:string`; response `CITA`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Keep record; cancelled interval becomes reusable, never delete.

## OP-24 — Registrar llegada
- Source: [§10 L2806](../source/analisis-y-modelo-relacional.md#L2806); Inst. **HPO**. Owner module `agenda`.
- `POST /api/citas/:id/llegada`; request `none`; response `CITA`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Source has no llegada enum; map arrival to confirmada; duplicate arrival idempotent confirmed, attended/cancelled rejected.

## OP-25 — Ver agenda del día
- Source: [§10 L2809](../source/analisis-y-modelo-relacional.md#L2809); Inst. **HPLO**. Owner module `agenda`.
- `GET /api/agenda`; request `fecha:date,id_profesional?:id`; response `CITA[]`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_query` plus common401/403/404/400/503; all failures leave state unchanged.
- Convert Guatemala day bounds to UTC half-open interval; role-safe projection omits motivo for nonclinical viewers.

## OP-26 — Abrir consulta
- Source: [§10 L2816](../source/analisis-y-modelo-relacional.md#L2816); Inst. **HPO**. Owner module `consultation`.
- `POST /api/pacientes/:id/consultas/abiertas`; request `OpenConsultaInput`; response `ConsultaDraft`; status policy above (baseline endpoints unchanged).
- Named domain error `expediente_archived` plus common401/403/404/400/503; all failures leave state unchanged.
- Persist open consultation+draft, optional owned confirmed appointment; keep baseline atomic closed shortcut unchanged.

## OP-27 — Registrar signos vitales
- Source: [§10 L2819](../source/analisis-y-modelo-relacional.md#L2819); Inst. **HP**. Owner module `consultation`.
- `PUT /api/consultas/:id/signos`; request `Input<SIGNOS_VITALES>`; response `SIGNOS_VITALES`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Enfermeria/medico only; one row per consultation; bounds source §5.1; no BMI persisted.

## OP-28 — Registrar diagnóstico
- Source: [§10 L2822](../source/analisis-y-modelo-relacional.md#L2822); Inst. **HPO**. Owner module `consultation`.
- `PUT /api/consultas/:id/borrador/diagnosticos`; request `diagnosticos:DiagnosticoInput[]`; response `ConsultaDraft`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_bundle` plus common401/403/404/400/503; all failures leave state unchanged.
- Store draft only with expected_revision; validate one primary; final normalized children only at close.

## OP-29 — Registrar tratamiento
- Source: [§10 L2825](../source/analisis-y-modelo-relacional.md#L2825); Inst. **HPO**. Owner module `consultation`.
- `PUT /api/consultas/:id/borrador/tratamientos`; request `tratamientos:TratamientoInput[]`; response `ConsultaDraft`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_bundle` plus common401/403/404/400/503; all failures leave state unchanged.
- Use diagnosis_index and expected_revision; diagnostic links validated at close; retained baseline enums.

## OP-30 — Emitir receta
- Source: [§10 L2828](../source/analisis-y-modelo-relacional.md#L2828); Inst. **HPO**. Owner module `consultation`.
- `PUT /api/consultas/:id/borrador/receta`; request `receta:CloseConsultaRequest.receta`; response `ConsultaDraft`; status policy above (baseline endpoints unchanged).
- Named domain error `reference_not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Validate active medications; final issued prescription and folio only when close commits; draft preview explicitly labeled not issued.

## OP-31 — Cerrar consulta
- Source: [§10 L2831](../source/analisis-y-modelo-relacional.md#L2831); Inst. **HPO**. Owner module `consultation`.
- `POST /api/consultas/:id/cierre`; request `expected_revision:int`; response `ConsultaCompleta`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_bundle` plus common401/403/404/400/503; all failures leave state unchanged.
- Atomically close persisted draft, children, prescription and consultation charge; extend baseline shortcut to charge in same native transaction too; mark linked appointment atendida.

## OP-32 — Anular consulta
- Source: [§10 L2834](../source/analisis-y-modelo-relacional.md#L2834); Inst. **HPO**. Owner module `consultation`.
- `POST /api/consultas/:id/anulacion`; request `motivo:string`; response `ConsultaDto`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Append reason/user/time, retain all clinical children; reject if consultation cargo already invoiced until invoice annulled; cancel only pending generated charges atomically.

## OP-33 — Consultar recetas del paciente
- Source: [§10 L2837](../source/analisis-y-modelo-relacional.md#L2837); Inst. **HPO**. Owner module `consultation`.
- `GET /api/pacientes/:id/recetas`; request `PageQuery`; response `Page<ConsultaCompleta>`; status policy above (baseline endpoints unchanged).
- Named domain error `not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Include issue date and annulled markers, medication detail and clinician; no fabricated interaction detection.

## OP-34 — Consultar camas disponibles
- Source: [§10 L2844](../source/analisis-y-modelo-relacional.md#L2844); Inst. **H**. Owner module `admission`.
- `GET /api/camas`; request `id_servicio?:id`; response `CAMA[]`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_query` plus common401/403/404/400/503; all failures leave state unchanged.
- Only libre scoped beds ordered service/id; show service tariff public values.

## OP-35 — Registrar ingreso
- Source: [§10 L2847](../source/analisis-y-modelo-relacional.md#L2847); Inst. **H**. Owner module `admission`.
- `POST /api/pacientes/:id/admisiones`; request `Input<ADMISION>`; response `ADMISION`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Lock expediente+bed; one active admission per record and bed; active expediente; owned ingreso diagnosis; admission+occupied bed atomic.

## OP-36 — Escribir nota de evolución
- Source: [§10 L2850](../source/analisis-y-modelo-relacional.md#L2850); Inst. **H**. Owner module `procedure`.
- `POST /api/admisiones/:id/notas`; request `Input<NOTA_EVOLUCION>`; response `NOTA_EVOLUCION`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Append-only, required ADMISION FK; correction references prior note in same admission, original content immutable.

## OP-37 — Registrar procedimiento
- Source: [§10 L2853](../source/analisis-y-modelo-relacional.md#L2853); Inst. **H**. Owner module `procedure`.
- `POST /api/procedimientos`; request `ProcedimientoBundle`; response `PROCEDIMIENTO`; status policy above (baseline endpoints unchanged).
- Named domain error `reference_not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Exactly one admission/consultation anchor; create procedure+team+consumption+charges atomically through shared ports, rollback on missing lot/stock.

## OP-38 — Registrar egreso
- Source: [§10 L2856](../source/analisis-y-modelo-relacional.md#L2856); Inst. **H**. Owner module `discharge`.
- `POST /api/admisiones/:id/egreso`; request `id_diagnostico_egreso:id,condicion_egreso:enum,fecha_hora_egreso:iso`; response `ADMISION`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Strictly later than ingreso; owned diagnosis; free bed and bill max(1,ceil(elapsed_hours/24)) days at snapshotted current bed tariff atomically.

## OP-39 — Solicitar estudio al laboratorio
- Source: [§10 L2859](../source/analisis-y-modelo-relacional.md#L2859); Inst. **H**. Owner module `referral`.
- `POST /api/consultas/:id/ordenes-laboratorio`; request `Input<ORDEN_ESTUDIO>,examenes:string[]`; response `ORDEN_ESTUDIO`; status policy above (baseline endpoints unchanged).
- Named domain error `reference_not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Local PG order+outbox commit; local worker imports lab order idempotently with explicit approved referral scope; never synchronous distributed transaction.

## OP-40 — Registrar antecedentes de nacimiento
- Source: [§10 L2866](../source/analisis-y-modelo-relacional.md#L2866); Inst. **P**. Owner module `growth`.
- `PUT /api/pacientes/:id/perinatal`; request `Input<ANTECEDENTE_PERINATAL>`; response `ANTECEDENTE_PERINATAL`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_body` plus common401/403/404/400/503; all failures leave state unchanged.
- Source §5.3 ranges, versioned audit on correction; active record required.

## OP-41 — Registrar medición de crecimiento
- Source: [§10 L2869](../source/analisis-y-modelo-relacional.md#L2869); Inst. **P**. Owner module `growth`.
- `POST /api/consultas/:id/mediciones`; request `MedicionInput`; response `MEDICION_ANTROPOMETRICA`; status policy above (baseline endpoints unchanged).
- Named domain error `reference_not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Compute age at measurement and WHO LMS percentiles/Z from pinned verified reference, store version and historical values; no synthetic WHO table.

## OP-42 — Ver curva de crecimiento
- Source: [§10 L2872](../source/analisis-y-modelo-relacional.md#L2872); Inst. **P**. Owner module `growth`.
- `GET /api/pacientes/:id/crecimiento`; request `none`; response `MEDICION_ANTROPOMETRICA[]`; status policy above (baseline endpoints unchanged).
- Named domain error `not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Chronological actual measurements SVG chart with WHO reference overlay; no line interpolation that pretends unmeasured data.

## OP-43 — Consultar esquema de vacunación
- Source: [§10 L2875](../source/analisis-y-modelo-relacional.md#L2875); Inst. **P**. Owner module `vaccines`.
- `GET /api/pacientes/:id/vacunas`; request `none`; response `DosisSchedule[]`; status policy above (baseline endpoints unchanged).
- Named domain error `reference_not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Idempotent scheduled dose creation from versioned explicit dose interval catalog; pending/overdue derived relative to clock, not invented dates.

## OP-44 — Registrar dosis aplicada
- Source: [§10 L2878](../source/analisis-y-modelo-relacional.md#L2878); Inst. **P**. Owner module `vaccines`.
- `POST /api/dosis/:id/aplicacion`; request `fecha_aplicacion:date,lote:string,fabricante?:string,sitio_aplicacion?:string,id_profesional:id`; response `DOSIS_VACUNA`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Validate dose <= catalog total; nonfuture date >= birth, required lot/professional; apply+update schedule atomically, repeated command idempotent.

## OP-45 — Registrar reacción adversa
- Source: [§10 L2881](../source/analisis-y-modelo-relacional.md#L2881); Inst. **P**. Owner module `vaccines`.
- `POST /api/dosis/:id/reacciones`; request `reaccion_adversa:string`; response `DOSIS_VACUNA`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Only applied dose accepts reaction, append safe audit, preserve lot and application date.

## OP-46 — Evaluar hitos de desarrollo
- Source: [§10 L2884](../source/analisis-y-modelo-relacional.md#L2884); Inst. **P**. Owner module `milestones`.
- `PUT /api/pacientes/:id/hitos/:hito`; request `Input<SEGUIMIENTO_HITO>`; response `SEGUIMIENTO_HITO`; status policy above (baseline endpoints unchanged).
- Named domain error `reference_not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Show expected catalog milestones by age; upsert reached flag with date/observations and immutable audit of previous evaluation.

## OP-47 — Listar dosis pendientes
- Source: [§10 L2887](../source/analisis-y-modelo-relacional.md#L2887); Inst. **P**. Owner module `vaccines`.
- `GET /api/vacunas/pendientes`; request `hasta:date,PageQuery`; response `Page<DosisPendiente>`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_query` plus common401/403/404/400/503; all failures leave state unchanged.
- Pending dates <= requested day, patient contact role-filtered, stable page; no automatic patient outreach.

## OP-48 — Recibir orden de examen
- Source: [§10 L2894](../source/analisis-y-modelo-relacional.md#L2894); Inst. **L**. Owner module `lab-intake`.
- `POST /api/laboratorio/ordenes`; request `LabOrderInput`; response `ORDEN_EXAMEN`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- One or more active exam codes; idempotent external origin/reference; referred patient mapped by explicit referral link not coincident numeric id.

## OP-49 — Registrar toma de muestra
- Source: [§10 L2897](../source/analisis-y-modelo-relacional.md#L2897); Inst. **L**. Owner module `lab-intake`.
- `POST /api/laboratorio/ordenes/:id/muestras`; request `Input<MUESTRA>`; response `MUESTRA`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Unique barcode, ordered exam-compatible sample, inadequate sample stored but cannot validate result.

## OP-50 — Cargar resultado
- Source: [§10 L2900](../source/analisis-y-modelo-relacional.md#L2900); Inst. **L**. Owner module `lab-results`.
- `POST /api/laboratorio/ordenes/:id/resultados`; request `ResultadoInput`; response `RESULTADO`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_bundle` plus common401/403/404/400/503; all failures leave state unchanged.
- Discriminated exam schema, correct sample/order, automatic reference flags and preliminary result+order state atomic; one current result per ordered exam.

## OP-51 — Validar resultado
- Source: [§10 L2903](../source/analisis-y-modelo-relacional.md#L2903); Inst. **L**. Owner module `lab-results`.
- `POST /api/laboratorio/resultados/:id/validacion`; request `none`; response `RESULTADO`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Authorized professional distinct? no source mandates distinct operator, allow qualified validator; when all ordered exams valid, order becomes validada atomically.

## OP-52 — Comparar contra valores de referencia
- Source: [§10 L2906](../source/analisis-y-modelo-relacional.md#L2906); Inst. **L**. Owner module `lab-results`.
- `POST /api/laboratorio/resultados/:id/comparacion`; request `none`; response `ResultadoFlags`; status policy above (baseline endpoints unchanged).
- Named domain error `reference_not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Also automatic inside OP50; sex/age interval [min,max), one matching range per numeric analyte; fail missing/ambiguous references, store reference snapshot.

## OP-53 — Entregar resultado
- Source: [§10 L2912](../source/analisis-y-modelo-relacional.md#L2912); Inst. **L**. Owner module `lab-results`.
- `POST /api/laboratorio/ordenes/:id/entrega`; request `none`; response `ORDEN_EXAMEN`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Only all validated; local order+delivery outbox atomic; result available at referring hospital after idempotent receipt, not before.

## OP-54 — Consultar historial de exámenes
- Source: [§10 L2915](../source/analisis-y-modelo-relacional.md#L2915); Inst. **L**. Owner module `lab-results`.
- `GET /api/pacientes/:id/examenes`; request `PageQuery`; response `Page<LabHistory>`; status policy above (baseline endpoints unchanged).
- Named domain error `not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- All owned exam results with preliminary/validated/rectified status; origin only receives delivered snapshot.

## OP-55 — Abrir odontograma
- Source: [§10 L2921](../source/analisis-y-modelo-relacional.md#L2921); Inst. **O**. Owner module `dental-chart`.
- `POST /api/pacientes/:id/odontogramas`; request `id_profesional:id,observacion_general?:string`; response `ODONTOGRAMA`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Create exactly 32 permanent FDI teeth (quadrants1..4 positions1..8) with sane surfaces, no 19/29/39/49; one chart per submitted command.

## OP-56 — Actualizar estado de una pieza
- Source: [§10 L2923](../source/analisis-y-modelo-relacional.md#L2923); Inst. **O**. Owner module `dental-chart`.
- `PUT /api/odontogramas/:id/piezas/:numero`; request `PiezaPatch`; response `PIEZA_DENTAL`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_body` plus common401/403/404/400/503; all failures leave state unchanged.
- Per-surface status map allows obturada oclusal+caries mesial simultaneously; expected revision prevents lost updates.

## OP-57 — Elaborar plan de tratamiento
- Source: [§10 L2925](../source/analisis-y-modelo-relacional.md#L2925); Inst. **O**. Owner module `dental-plan`.
- `POST /api/pacientes/:id/planes`; request `PlanInput`; response `PLAN_TRATAMIENTO`; status policy above (baseline endpoints unchanged).
- Named domain error `reference_not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Nonempty ordered procedure/tooth lines with snapshot price; calculate total, stable line ids, max100 lines, no user supplied total.

## OP-58 — Aceptar plan de tratamiento
- Source: [§10 L2927](../source/analisis-y-modelo-relacional.md#L2927); Inst. **O**. Owner module `dental-plan`.
- `POST /api/planes/:id/aceptacion`; request `none`; response `PLAN_TRATAMIENTO`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Source OP says in-progress, schema also aceptado: audit proposed->accepted->in-progress in one transaction; immutable accepted budget.

## OP-59 — Registrar sesión de tratamiento
- Source: [§10 L2929](../source/analisis-y-modelo-relacional.md#L2929); Inst. **O**. Owner module `dental-session`.
- `POST /api/planes/:id/sesiones`; request `SesionInput`; response `SESION_TRATAMIENTO`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Validate performed plan lines not repeated; session+line completion+procedure charges atomic; completed all marks finalizado.

## OP-60 — Consultar saldo del paciente
- Source: [§10 L2931](../source/analisis-y-modelo-relacional.md#L2931); Inst. **O**. Owner module `dental-session`.
- `GET /api/pacientes/:id/saldo-dental`; request `none`; response `DentalBalance`; status policy above (baseline endpoints unchanged).
- Named domain error `not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Budget, performed/billed, paid and remaining separately; join real billing port, never equate session count with payment.

## OP-61 — Administrar personal
- Source: [§10 L2936](../source/analisis-y-modelo-relacional.md#L2936); Inst. **HPLO**. Owner module `personnel`.
- `POST /api/personal`; request `PersonalInput`; response `PersonalDto`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Keep locked PROFESIONAL B; separate 1:1 contrato table stores category/contract/start; conditional colegiado, no forbidden columns on profesional.

## OP-62 — Definir tarifa de honorarios
- Source: [§10 L2939](../source/analisis-y-modelo-relacional.md#L2939); Inst. **HPLO**. Owner module `personnel`.
- `POST /api/personal/:id/tarifas`; request `Input<TARIFA_HONORARIO>`; response `TARIFA_HONORARIO`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Honorarios type only, no planilla; lock professional+service; nonoverlapping [desde,hasta) version windows; cannot mutate historical tariffs.

## OP-63 — Registrar el equipo de una atención
- Source: [§10 L2942](../source/analisis-y-modelo-relacional.md#L2942); Inst. **HPO**. Owner module `honoraria`.
- `POST /api/participaciones`; request `Input<PARTICIPACION>`; response `PARTICIPACION`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Exactly one consultation/procedure, unique role+professional+act; scoped professional.

## OP-64 — Calcular honorarios de un acto
- Source: [§10 L2945](../source/analisis-y-modelo-relacional.md#L2945); Inst. **HPO**. Owner module `honoraria`.
- `POST /api/actos/honorarios`; request `ActRef`; response `PARTICIPACION[]`; status policy above (baseline endpoints unchanged).
- Named domain error `reference_not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Snapshot tariff at act time times role factor; percentage of service price; persist amount+idempotent honorario charge in same transaction, never recalculate history silently.

## OP-65 — Liquidar honorarios de un período
- Source: [§10 L2948](../source/analisis-y-modelo-relacional.md#L2948); Inst. **HPO**. Owner module `honoraria`.
- `GET /api/honorarios/liquidacion`; request `desde:date,hasta:date,id_profesional?:id`; response `Liquidacion[]`; status policy above (baseline endpoints unchanged).
- Named domain error `forbidden` plus common401/403/404/400/503; all failures leave state unchanged.
- Monthly report by professional/act/role, RRHH all; clinical self only; no actual bank payouts.

## OP-66 — Registrar consumo de material
- Source: [§10 L2951](../source/analisis-y-modelo-relacional.md#L2951); Inst. **HPLO**. Owner module `inventory`.
- `POST /api/consumos`; request `Input<CONSUMO_INSUMO>,id_paciente:id`; response `CONSUMO_INSUMO`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Atomic consumption+stock decrement+charge; positive integer quantity while source stock INT; controlled/requires_lote needs lot; one or zero act anchors with explicit patient.

## OP-67 — Consultar existencias
- Source: [§10 L2954](../source/analisis-y-modelo-relacional.md#L2954); Inst. **HPLO**. Owner module `inventory`.
- `GET /api/insumos`; request `PageQuery,bajo_stock?:boolean`; response `Page<INSUMO>`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_query` plus common401/403/404/400/503; all failures leave state unchanged.
- Low-stock academic threshold <=5 configurable seed metadata, actual counts; public projection excludes cost to unauthorized role.

## OP-68 — Generar cargo
- Source: [§10 L2957](../source/analisis-y-modelo-relacional.md#L2957); Inst. **HPLO**. Owner module `charges`.
- `POST /api/cargos`; request `CargoInput`; response `CARGO`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Shared application port reused inside close/exit/consume/honoraria/dental; unique source event key, snapshot price; manual charges authorized caja only.

## OP-69 — Consultar cargos pendientes
- Source: [§10 L2960](../source/analisis-y-modelo-relacional.md#L2960); Inst. **HPLO**. Owner module `charges`.
- `GET /api/pacientes/:id/cargos`; request `PageQuery`; response `Page<CargoCaja>`; status policy above (baseline endpoints unchanged).
- Named domain error `not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Only pendiente, safe projection no clinical origin FKs/descriptions, generic service label for reception.

## OP-70 — Anular o marcar cortesía un cargo
- Source: [§10 L2963](../source/analisis-y-modelo-relacional.md#L2963); Inst. **HPLO**. Owner module `charges`.
- `POST /api/cargos/:id/disposicion`; request `estado:anulado_or_cortesia,motivo:string`; response `CargoCaja`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Caja with explicit cargo.autorizar permission only; reason audited, invoiced rejects.

## OP-71 — Consultar tarifario
- Source: [§10 L2969](../source/analisis-y-modelo-relacional.md#L2969); Inst. **HPLO**. Owner module `charges`.
- `GET /api/tarifario`; request `PageQuery`; response `Page<SERVICIO_FACTURABLE>`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_query` plus common401/403/404/400/503; all failures leave state unchanged.
- Institution tariff read, no private contract honoraria, active service list.

## OP-72 — Seleccionar cargos a facturar
- Source: [§10 L2972](../source/analisis-y-modelo-relacional.md#L2972); Inst. **HPLO**. Owner module `invoicing`.
- `POST /api/pacientes/:id/facturas/preview`; request `cargo_ids:id[]`; response `InvoicePreview`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Nonempty unique owned pending ids, compute immutable snapshot preview hash; preview does not reserve or mutate cargo, revalidate at issue.

## OP-73 — Emitir factura
- Source: [§10 L2975](../source/analisis-y-modelo-relacional.md#L2975); Inst. **HPLO**. Owner module `invoicing`.
- `POST /api/pacientes/:id/facturas`; request `FacturaInput`; response `FacturaCompleta`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Native atomic invoice+lines+mark cargos+transactional series counter, gapless successful commits; 12% IVA taxable discounted base; no real FEL call.

## OP-74 — Registrar pago
- Source: [§10 L2980](../source/analisis-y-modelo-relacional.md#L2980); Inst. **HPLO**. Owner module `payments`.
- `POST /api/facturas/:id/pagos`; request `PagoInput`; response `FacturaCompleta`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Lock invoice, amount<=balance, nonannulled, charge+balance+state atomic; idempotency required; card is simulated method label no PAN capture/provider.

## OP-75 — Anular factura
- Source: [§10 L2983](../source/analisis-y-modelo-relacional.md#L2983); Inst. **HPLO**. Owner module `payments`.
- `POST /api/facturas/:id/anulacion`; request `motivo:string`; response `FacturaCompleta`; status policy above (baseline endpoints unchanged).
- Named domain error `conflict` plus common401/403/404/400/503; all failures leave state unchanged.
- Mark invoice+all payments annulled, balance0, cargo anulado, retain sequence forever; no automatic real refunds.

## OP-76 — Consultar estado de cuenta
- Source: [§10 L2986](../source/analisis-y-modelo-relacional.md#L2986); Inst. **HPLO**. Owner module `payments`.
- `GET /api/pacientes/:id/cuenta`; request `PageQuery`; response `EstadoCuenta`; status policy above (baseline endpoints unchanged).
- Named domain error `not_found` plus common401/403/404/400/503; all failures leave state unchanged.
- Actual invoices/payments/balances; patient role requires bound patient id, otherwise no self access; clinician sees balance only not payments.

## OP-77 — Cierre de caja
- Source: [§10 L2989](../source/analisis-y-modelo-relacional.md#L2989); Inst. **HPLO**. Owner module `payments`.
- `GET /api/caja/cierre`; request `fecha:date`; response `CierreCaja`; status policy above (baseline endpoints unchanged).
- Named domain error `invalid_query` plus common401/403/404/400/503; all failures leave state unchanged.
- Guatemala day aggregate nonannulled payments by method; include annulation totals separately, no fictitious fiscal submission.

## Inclusive consultation boundary — Nov8 router adoption

Let serialized = JSON.stringify(bundle), using JavaScript's ordinary serializer with no replacer or indentation; bytes = Buffer.byteLength(serialized, 'utf8'). Accept the size check iff bytes <= 262144 (≤256 KiB); bytes > 262144 throws ClinicalError('invalid_bundle'). This is UTF-8 bytes of the actual serialized bundle, including JSON punctuation, property names and escaping—not string.length, code points, original HTTP bytes, BSON size or a reserialized/canonicalized object. Do not normalize Unicode, strip fields or trim text before this size calculation. Acceptance of this size check does not waive other clinical invariants. This consultation-specific bound overrides the generic700KiB new-payload ceiling; other full77 operation schemas and limits unchanged. See [canonical C5](../../contracts/DOCUMENTS-SECURITY.md) and root ADOPTION/DECISIONS for provenance and named test requirements.
