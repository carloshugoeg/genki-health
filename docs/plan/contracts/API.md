# Frozen contract C2 — HTTP, types and validation

## C2.1 Types

Keep all fields/types of existing `shared/src/clinical.ts`, `auth.ts`, `engines.ts`, `ids.ts`; do not copy/remove their branded keys. New code goes in `shared/src/mvp.ts` and is exported from `shared/src/index.ts`. Its exact structural additions are:

```ts
import type { PacienteDto, ExpedienteDto, ConsultaDto, DiagnosticoDto,
  TratamientoDto, RecetaDto, DetalleRecetaDto, MotivoArchivo } from './clinical.js';
export interface ResponsableInput {
  tipo_documento: string; numero_documento: string; nombre_completo: string;
  parentesco: 'madre'|'padre'|'abuelo'|'tutor_legal'|'otro'; telefono: string;
  correo?: string|null; direccion?: string|null; es_principal: boolean;
}
export interface RegisterPacienteRequest {
  tipo_documento: string; numero_documento: string; primer_nombre: string;
  segundo_nombre?: string|null; primer_apellido: string; segundo_apellido?: string|null;
  fecha_nacimiento: string; sexo: 'M'|'F'|'X'; tipo_sangre?: string|null;
  telefono?: string|null; correo?: string|null; direccion?: string|null;
  id_municipio?: number|null; responsables?: ResponsableInput[];
}
export interface DiagnosticoInput {
  codigo_cie10?: string|null; descripcion: string;
  tipo: 'presuntivo'|'definitivo'; es_principal: boolean;
}
export interface TratamientoInput {
  diagnostico_index: number; tipo: 'farmacologico'|'procedimiento'|'terapia'|'reposo'|'dieta';
  descripcion: string; indicaciones?: string|null; fecha_inicio: string;
  fecha_fin_estimada?: string|null; estado: 'activo';
}
export type DetalleInput = Omit<DetalleRecetaDto,'id_receta'>;
export interface CloseConsultaRequest {
  id_profesional: number; fecha_hora_inicio: string; tipo: 'primera_vez'|'seguimiento';
  motivo_consulta: string; enfermedad_actual?: string|null;
  exploracion_fisica?: string|null; plan?: string|null;
  diagnosticos: DiagnosticoInput[]; tratamientos: TratamientoInput[];
  receta?: {observaciones?: string|null; detalles: DetalleInput[]};
}
export interface ConsultaCompleta {
  consulta: ConsultaDto; diagnosticos: DiagnosticoDto[];
  tratamientos: TratamientoDto[]; receta: RecetaDto|null; detalles: DetalleRecetaDto[];
}
export interface PacienteResumen {paciente: PacienteDto; expediente: ExpedienteDto}
export interface PacientePage {items: PacienteResumen[]; page: number; page_size: number; total: number}
export interface HistorialDto extends PacienteResumen {consultas: ConsultaCompleta[]}
export interface CatalogosDto {
  municipios: {id_municipio:number; nombre:string}[];
  profesionales: {id_profesional:number; nombres:string; apellidos:string}[];
  medicamentos: {id_medicamento:number; nombre_generico:string}[];
}
export interface ArchiveRequest {motivo_archivo: MotivoArchivo; observacion_archivo?: string}
export type ClinicalErrorCode = 'invalid_body'|'invalid_query'|'missing_bearer'|
 'invalid_credentials'|'invalid_token'|'password_policy'|'forbidden'|'not_found'|
 'duplicate_document'|'guardian_required'|'invalid_guardians'|'expediente_archived'|
 'already_archived'|'invalid_bundle'|'reference_not_found'|'conflict'|
 'store_unavailable'|'misconfigured'|'internal_error';
export interface ErrorDto {error: ClinicalErrorCode; message: string}
```

Domain types (no import from shared into domain at runtime): `server/src/domain/clinical-error.ts` exports ClinicalError extends Error, constructor(readonly code: ClinicalErrorCode, message: string); define the code union locally there and verify type equality in a test. `server/src/domain/consulta.ts` takes primitive structural inputs; `validateConsulta(input, nowIso)` throws invalid_bundle for diagnosis/treatment/recipe invariants C1.2. Domain expediente rule remains in existing expediente-estado.ts. HTTP uses Zod; domain independently enforces state and clinical invariants so a non-HTTP caller cannot bypass them.

## C2.2 Zod schemas (frozen validation algorithm)

Create `server/src/adapters/http/schemas.ts`. Zod 3 is already a server dependency. This exact schema skeleton is normative; use `.strict()` on every object below (including nested objects). No Zod dependency is introduced in domain or shared.

```ts
import {z} from 'zod';
const text = (n:number) => z.string().trim().min(1).max(n);
const nullable = (n:number) => text(n).nullable().optional();
const id = z.number().int().positive().max(2147483647);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s+'T00:00:00.000Z');
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10)===s;
});
const iso = z.string().datetime({offset:false});
const doc = text(25).transform(s=>s.toUpperCase());
const email = z.string().trim().email().max(120);
export const kind = z.enum(['hospital_general','centro_pediatrico',
 'laboratorio_clinico','clinica_odontologica']);
export const loginSchema = z.object({email,password:z.string().min(1).max(200),
 institution_kind:kind}).strict();
export const refreshSchema = z.object({refresh_token:text(4096)}).strict();
export const responsableSchema = z.object({tipo_documento:text(20),numero_documento:doc,
 nombre_completo:text(150),parentesco:z.enum(['madre','padre','abuelo','tutor_legal','otro']),
 telefono:text(25),correo:email.nullable().optional(),direccion:nullable(250),
 es_principal:z.boolean()}).strict();
export const registerSchema = z.object({tipo_documento:text(20),numero_documento:doc,
 primer_nombre:text(60),segundo_nombre:nullable(60),primer_apellido:text(60),
 segundo_apellido:nullable(60),fecha_nacimiento:date,sexo:z.enum(['M','F','X']),
 tipo_sangre:nullable(5),telefono:nullable(25),correo:email.nullable().optional(),
 direccion:nullable(250),id_municipio:id.nullable().optional(),
 responsables:z.array(responsableSchema).max(5).optional()}).strict();
export const archiveSchema = z.object({motivo_archivo:z.enum([
 'traslado','fallecimiento','administrativo','inactividad']),
 observacion_archivo:text(500).optional()}).strict();
export const diagnosticoSchema = z.object({codigo_cie10:nullable(10),descripcion:text(500),
 tipo:z.enum(['presuntivo','definitivo']),es_principal:z.boolean()}).strict();
export const tratamientoSchema = z.object({diagnostico_index:z.number().int().min(0),
 tipo:z.enum(['farmacologico','procedimiento','terapia','reposo','dieta']),descripcion:text(1000),
 indicaciones:nullable(1000),fecha_inicio:date,fecha_fin_estimada:date.nullable().optional(),
 estado:z.literal('activo')}).strict();
export const detalleSchema = z.object({id_medicamento:id,dosis:text(100),
 via_administracion:text(50),frecuencia_horas:z.number().int().min(1).max(168),
 duracion_dias:z.number().int().min(1).max(365),cantidad:z.number().positive().max(999999.99),
 indicaciones:nullable(1000)}).strict();
export const closeSchema = z.object({id_profesional:id,fecha_hora_inicio:iso,
 tipo:z.enum(['primera_vez','seguimiento']),motivo_consulta:text(500),
 enfermedad_actual:nullable(2000),exploracion_fisica:nullable(2000),plan:nullable(2000),
 diagnosticos:z.array(diagnosticoSchema).min(1).max(10),
 tratamientos:z.array(tratamientoSchema).min(1).max(20),
 receta:z.object({observaciones:nullable(1000),
 detalles:z.array(detalleSchema).min(1).max(20)}).strict().optional()}).strict();
export const searchSchema = z.object({q:z.string().trim().max(100).default(''),
 estado:z.enum(['activo','archivado','todos']).default('activo'),
 page:z.coerce.number().int().min(1).max(10000).default(1),
 page_size:z.coerce.number().int().min(1).max(50).default(20)}).strict();
export const paramsSchema = z.object({id:z.coerce.number().int().positive().max(2147483647)}).strict();
```

Birth cannot be later than clock's UTC date. Consultation start cannot be later than now, end supplied by server; treatment end when present ≥ start. Decimal cantidad accepts at most two decimal places (`Math.round(n*100)===n*100` with epsilon 1e-8); schema refinement enforces this. Structural schema failures → invalid_body/invalid_query 400. Semantic cross-field failures → invalid_bundle 422, future birth → invalid_body 400. Schema DTO parity tests cover all names and bounds. Unknown keys, client institution/engine/state/archive date and client id values are rejected.

## C2.3 Route table (complete live API)

All API success/error bodies JSON except 204; health unauthenticated. A fastify handler validates structural input before invoking use case, authentication before any clinical input lookup. CORS unnecessary: Vite proxy to API. Read-only roles: all reads. Mutation roles: `administrador`, `recepcion` register/archive; `administrador`, `medico` close. Seed demo users carry administrador so all demo actions work. Other roles receive forbidden 403. No client Firebase authentication.

|Method/path|Request|200/201 response|Other statuses/codes|
|---|---|---|---|
|GET /health|none|200 `{ok:true,phase:'e2-mvp'}`|503 store_unavailable when real-mode startup checks fail (normally startup exits instead)|
|GET /api/auth/institutions|none|200 `{institutions:[{kind,nombre,motor}]}` with four existing spellings|500 internal_error|
|POST /api/auth/login|LoginRequestDto/loginSchema|200 AuthTokensDto|400 invalid_body;401 invalid_credentials (also for any wrong password, policy not revealed);500 misconfigured;503 store_unavailable|
|POST /api/auth/refresh|refreshSchema|200 AuthTokensDto|400 invalid_body;401 invalid_token;500 misconfigured;503 store_unavailable|
|POST /api/auth/logout|refreshSchema (signature required, no access bearer needed)|204 empty; idempotent for a valid, previously revoked signed refresh|400 invalid_body;401 invalid_token (bad/expired JWT);503 store_unavailable|
|GET /api/auth/me|Bearer|200 AuthPrincipalDto|401 missing_bearer/invalid_token;503 store_unavailable|
|GET /api/catalogos|Bearer|200 CatalogosDto, institution-local catalogs|401;403 forbidden;503|
|POST /api/pacientes|Bearer + RegisterPacienteRequest|201 PacienteResumen|400 invalid_body;401;403;409 duplicate_document;422 guardian_required/invalid_guardians/reference_not_found;503|
|GET /api/pacientes|Bearer + searchSchema query|200 PacientePage sorted id_paciente ascending|400 invalid_query;401;403;503|
|GET /api/pacientes/:id|Bearer + positive id|200 HistorialDto with consultas sorted start desc, id desc; children by id asc|400 invalid_query;401;403;404 not_found;503|
|POST /api/pacientes/:id/consultas|Bearer + CloseConsultaRequest|201 ConsultaCompleta|400 invalid_body/invalid_query;401;403;404 not_found;409 expediente_archived/conflict;422 invalid_bundle/reference_not_found;503|
|POST /api/pacientes/:id/archivo|Bearer + ArchiveRequest|200 ExpedienteDto|400 invalid_body/invalid_query;401;403;404 not_found;409 already_archived/conflict;503|

Unrecognized routes return 404 `{error:'not_found',message:'Recurso no encontrado'}`. All unexpected exceptions 500 internal_error. Abbreviated `401` in rows means missing_bearer or invalid_token; `403` forbidden; `503` store_unavailable. Clinical routes do not accept institution in path/query/body. Route parameter is ALWAYS patient id, never an expediente id. Application resolves and verifies ownership of the associated expediente before archive/consultation; fixes existing archive function's independent patient/expediente inputs.

## C2.4 Error catalog

|Code|Status|Spanish safe message / meaning|
|---|---|---|
|invalid_body|400|Solicitud inválida (schema/future birth)|
|invalid_query|400|Parámetros inválidos|
|missing_bearer|401|Se requiere autenticación|
|invalid_credentials|401|Credenciales o institución inválidas|
|invalid_token|401|Sesión inválida o vencida (includes refresh replay)|
|password_policy|400|Contraseña fuera de la política mínima|
|forbidden|403|Permiso insuficiente|
|not_found|404|Recurso no encontrado (including another institution's id)|
|duplicate_document|409|Documento ya registrado en esta institución|
|guardian_required|422|Se requiere responsable principal|
|invalid_guardians|422|Debe existir exactamente un responsable principal|
|expediente_archived|409|El expediente está archivado|
|already_archived|409|El expediente ya está archivado|
|invalid_bundle|422|Atención clínica inconsistente|
|reference_not_found|422|Referencia clínica inválida (municipio/profesional/CIE10/medicamento)|
|conflict|409|Operación en conflicto; vuelva a cargar (exhausted transaction retry)|
|store_unavailable|503|Almacén no disponible|
|misconfigured|500|Configuración inválida|
|internal_error|500|Error interno|

Do not expose SQL, driver stack, JWT, hash, password or document contents in error logs. HTTP logger redacts authorization/password/refresh_token and clinical bodies. Map native duplicate patient-document errors to duplicate_document, native FK failures to reference_not_found, unavailable connections to store_unavailable. Retry transaction conflicts at most three times (fresh callback, no external side effects); after three use conflict, never retry duplicate/validation errors.

