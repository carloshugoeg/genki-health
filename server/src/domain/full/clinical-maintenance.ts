/**
 * Mantenimiento de historiales (brief, Entrega II): close an open consultation (OP-31) and
 * correct diagnoses, treatments and prescriptions after the fact. Entrega I rule 3 (§ reglas
 * generales): clinical data is never deleted; corrections are annulments or audited changes.
 * Annulment reuses each entity's own status domain from Entrega I:
 *   DIAGNOSTICO.tipo   presuntivo | definitivo | descartado   (anular → descartado)
 *   TRATAMIENTO.estado vigente(activo) | finalizado | suspendido (anular → suspendido)
 *   RECETA.estado      emitida | anulada                      (anular → anulada)
 * Every change writes one BITACORA row (accion `modificacion`, detalle = antes/después).
 */
import { ClinicalError } from '../clinical-error.js';
import { assertRoles, isPlainObject } from './specialty-common.js';

export const CLINICAL_MAINTENANCE_ROLES = ['medico', 'odontologo'] as const;

export const OPEN_CONSULTATION_BLOCKS_ARCHIVE =
  'El paciente tiene una consulta abierta; ciérrela antes de archivar el expediente';
export const CONSULTA_NO_ABIERTA =
  'La consulta no está abierta; solo se cierra una consulta abierta';
export const CONSULTA_NO_CERRADA =
  'Solo se corrigen diagnósticos, tratamientos o recetas de una consulta cerrada';
export const ITEM_YA_ANULADO = 'El registro ya fue anulado; no admite más cambios';
export const SIN_CAMBIOS = 'La modificación no cambia ningún valor';
export const PROFESIONAL_NO_VINCULADO =
  'El usuario no tiene un profesional vinculado; no puede registrar atención clínica';
export const PROFESIONAL_AJENO = 'El profesional indicado no corresponde al usuario autenticado';

export type ClinicalItemEntity = 'diagnostico' | 'tratamiento' | 'receta';
export const CLINICAL_ITEM_ENTITIES: readonly ClinicalItemEntity[] = [
  'diagnostico',
  'tratamiento',
  'receta',
];

/** Domain-local mirrors of the DTO fields that may change (no @genki/shared import). */
export interface DiagnosticoValues {
  tipo: string;
  descripcion: string;
}
export interface TratamientoValues {
  estado: string;
  indicaciones: string | null;
  fecha_inicio: string;
  fecha_fin_estimada: string | null;
}
export interface RecetaValues {
  estado: string;
  observaciones: string | null;
}

export type ItemValues =
  | { entidad: 'diagnostico'; values: DiagnosticoValues }
  | { entidad: 'tratamiento'; values: TratamientoValues }
  | { entidad: 'receta'; values: RecetaValues };

export type ItemPatch =
  | { entidad: 'diagnostico'; tipo?: string; descripcion?: string }
  | {
      entidad: 'tratamiento';
      estado?: string;
      indicaciones?: string | null;
      fecha_fin_estimada?: string | null;
    }
  | { entidad: 'receta'; estado?: string; observaciones?: string | null };

export type Cambios =
  | { entidad: 'diagnostico'; tipo?: 'presuntivo' | 'definitivo'; descripcion?: string }
  | {
      entidad: 'tratamiento';
      estado?: 'activo' | 'finalizado';
      indicaciones?: string | null;
      fecha_fin_estimada?: string | null;
    }
  | { entidad: 'receta'; observaciones?: string | null };

export interface AmendmentPlan {
  patch: ItemPatch;
  /** Only the changed fields, for BITACORA.detalle. */
  antes: Record<string, string | null>;
  despues: Record<string, string | null>;
  campos: string[];
}

const ANNULLED: Record<ClinicalItemEntity, { field: string; value: string }> = {
  diagnostico: { field: 'tipo', value: 'descartado' },
  tratamiento: { field: 'estado', value: 'suspendido' },
  receta: { field: 'estado', value: 'anulada' },
};

/** OP number recorded in BITACORA.detalle.op (Entrega I §10.5). */
export const OP_BY_ENTITY: Record<ClinicalItemEntity | 'consulta', number> = {
  consulta: 31,
  diagnostico: 28,
  tratamiento: 29,
  receta: 30,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function invalid(): never {
  throw new ClinicalError('invalid_body', 'Solicitud inválida');
}

function boundedText(value: unknown, max: number): string {
  if (typeof value !== 'string') invalid();
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max || trimmed.includes('\u0000')) invalid();
  return trimmed;
}

function nullableText(value: unknown, max: number): string | null {
  if (value === null) return null;
  return boundedText(value, max);
}

function isoDate(value: unknown): string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) invalid();
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid();
  return value;
}

function assertKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(body)) if (!allowed.includes(key)) invalid();
}

export function assertClinicalMaintenanceRole(roles: readonly string[]): void {
  assertRoles(roles, CLINICAL_MAINTENANCE_ROLES);
}

export function parseEntity(value: unknown): ClinicalItemEntity {
  if (typeof value !== 'string' || !(CLINICAL_ITEM_ENTITIES as readonly string[]).includes(value))
    throw new ClinicalError('invalid_query', 'Parámetros inválidos');
  return value as ClinicalItemEntity;
}

export function parseMotivo(body: unknown): string {
  if (!isPlainObject(body)) invalid();
  return boundedText(body.motivo, 300);
}

export function parseAnulacionBody(body: unknown): { motivo: string } {
  if (!isPlainObject(body)) invalid();
  assertKeys(body, ['motivo']);
  return { motivo: boundedText(body.motivo, 300) };
}

/** Validates the PATCH body for one entity. `motivo` is mandatory for the audit trail. */
export function parseModificacionBody(
  entidad: ClinicalItemEntity,
  body: unknown,
): { motivo: string; cambios: Cambios } {
  if (!isPlainObject(body)) invalid();
  const motivo = boundedText(body.motivo, 300);
  if (entidad === 'diagnostico') {
    assertKeys(body, ['motivo', 'tipo', 'descripcion']);
    const cambios: Cambios = { entidad };
    if ('tipo' in body) {
      if (body.tipo !== 'presuntivo' && body.tipo !== 'definitivo') invalid();
      cambios.tipo = body.tipo;
    }
    if ('descripcion' in body) cambios.descripcion = boundedText(body.descripcion, 500);
    if (cambios.tipo === undefined && cambios.descripcion === undefined) invalid();
    return { motivo, cambios };
  }
  if (entidad === 'tratamiento') {
    assertKeys(body, ['motivo', 'estado', 'indicaciones', 'fecha_fin_estimada']);
    const cambios: Cambios = { entidad };
    if ('estado' in body) {
      if (body.estado !== 'activo' && body.estado !== 'finalizado') invalid();
      cambios.estado = body.estado;
    }
    if ('indicaciones' in body) cambios.indicaciones = nullableText(body.indicaciones, 1000);
    if ('fecha_fin_estimada' in body)
      cambios.fecha_fin_estimada =
        body.fecha_fin_estimada === null ? null : isoDate(body.fecha_fin_estimada);
    if (
      cambios.estado === undefined &&
      cambios.indicaciones === undefined &&
      cambios.fecha_fin_estimada === undefined
    )
      invalid();
    return { motivo, cambios };
  }
  assertKeys(body, ['motivo', 'observaciones']);
  if (!('observaciones' in body)) invalid();
  return { motivo, cambios: { entidad, observaciones: nullableText(body.observaciones, 1000) } };
}

export function isAnnulled(current: ItemValues): boolean {
  const rule = ANNULLED[current.entidad];
  return (current.values as unknown as Record<string, unknown>)[rule.field] === rule.value;
}

function diff(
  current: Record<string, unknown>,
  next: Record<string, string | null | undefined>,
): Pick<AmendmentPlan, 'antes' | 'despues' | 'campos'> {
  const antes: Record<string, string | null> = {};
  const despues: Record<string, string | null> = {};
  const campos: string[] = [];
  for (const [field, value] of Object.entries(next)) {
    if (value === undefined) continue;
    const before = (current[field] ?? null) as string | null;
    if (before === value) continue;
    antes[field] = before;
    despues[field] = value;
    campos.push(field);
  }
  return { antes, despues, campos };
}

/**
 * Pure state transition for a correction. Throws `conflict` when the row is already annulled
 * or the change is a no-op, `invalid_bundle` when dates become inconsistent.
 */
export function planModificacion(current: ItemValues, cambios: Cambios): AmendmentPlan {
  if (current.entidad !== cambios.entidad) invalid();
  if (isAnnulled(current)) throw new ClinicalError('conflict', ITEM_YA_ANULADO);
  const { entidad: _entidad, ...fields } = cambios;
  const result = diff(current.values as unknown as Record<string, unknown>, fields);
  if (result.campos.length === 0) throw new ClinicalError('conflict', SIN_CAMBIOS);
  if (current.entidad === 'tratamiento' && result.despues.fecha_fin_estimada) {
    if (result.despues.fecha_fin_estimada < current.values.fecha_inicio)
      throw new ClinicalError(
        'invalid_bundle',
        'La fecha fin estimada no puede ser anterior a la fecha de inicio',
      );
  }
  const patch = { entidad: current.entidad, ...result.despues } as ItemPatch;
  return { patch, ...result };
}

export function planAnulacion(current: ItemValues): AmendmentPlan {
  if (isAnnulled(current)) throw new ClinicalError('conflict', ITEM_YA_ANULADO);
  const rule = ANNULLED[current.entidad];
  const result = diff(current.values as unknown as Record<string, unknown>, {
    [rule.field]: rule.value,
  });
  const patch = { entidad: current.entidad, [rule.field]: rule.value } as ItemPatch;
  return { patch, ...result };
}

/** Corrections apply only to children of a closed consultation on an active expediente. */
export function assertAmendable(state: {
  consulta_estado: string;
  expediente_estado: string;
}): void {
  if (state.expediente_estado === 'archivado')
    throw new ClinicalError('expediente_archived', 'El expediente está archivado');
  if (state.consulta_estado !== 'cerrada') throw new ClinicalError('conflict', CONSULTA_NO_CERRADA);
}

export function assertClosable(state: {
  consulta_estado: string;
  expediente_estado: string;
}): void {
  if (state.expediente_estado === 'archivado')
    throw new ClinicalError('expediente_archived', 'El expediente está archivado');
  if (state.consulta_estado !== 'abierta') throw new ClinicalError('conflict', CONSULTA_NO_ABIERTA);
}

/**
 * Attribution: the professional of a clinical act comes from the authenticated user's
 * USUARIO.id_profesional. A body value is accepted only when it matches, or when the user has no
 * linked professional (legacy clients); never silently replaced by a constant.
 */
export function resolveActingProfesional(
  actorProfesional: number | null,
  bodyProfesional: number | undefined,
): number {
  if (actorProfesional != null) {
    if (bodyProfesional !== undefined && bodyProfesional !== actorProfesional)
      throw new ClinicalError('forbidden', PROFESIONAL_AJENO);
    return actorProfesional;
  }
  if (bodyProfesional === undefined) throw new ClinicalError('forbidden', PROFESIONAL_NO_VINCULADO);
  return bodyProfesional;
}
