import type { ProcedimientoBundle } from '@genki/shared/full/procedure';
import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export const NOTE_ROLES = ['medico', 'enfermeria'] as const;
export const PROCEDURE_ROLES = ['medico'] as const;

export function assertNoteRole(roles: readonly string[]): void {
  assertRoles(roles, NOTE_ROLES);
}

export function assertProcedureRole(roles: readonly string[]): void {
  assertRoles(roles, PROCEDURE_ROLES);
}

/** Parsed OP-37 body; `id_profesional` is resolved later from the authenticated user. */
export type ParsedOp37Body = Omit<ProcedimientoBundle, 'id_profesional'> & {
  id_profesional?: number;
};

function optionalText(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.length > max) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * OP-37 (contract ProcedimientoBundle, Entrega I PROCEDIMIENTO). Exactly one of id_admision /
 * id_consulta. `equipo` / `consumos` default to [] (no participants/supplies recorded) and
 * `id_profesional` defaults to the authenticated user's professional. Keys outside the model
 * (e.g. id_paciente, descripcion) are ignored: the patient is implied by the admission/consultation.
 */
export function parseOp37Body(body: unknown): ParsedOp37Body {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  const hasAdm = body.id_admision != null;
  const hasCons = body.id_consulta != null;
  if (hasAdm === hasCons) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (
    typeof body.codigo_procedimiento !== 'string' ||
    body.codigo_procedimiento.trim().length < 1 ||
    body.codigo_procedimiento.trim().length > 10
  ) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (typeof body.fecha_hora !== 'string' || Number.isNaN(Date.parse(body.fecha_hora))) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const equipo = body.equipo ?? [];
  const consumos = body.consumos ?? [];
  if (!Array.isArray(equipo) || !Array.isArray(consumos)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const sala = optionalText(body.sala, 20);
  const hallazgos = optionalText(body.hallazgos, 10000);
  const complicaciones = optionalText(body.complicaciones, 10000);
  return {
    ...(hasAdm ? { id_admision: assertPositiveId(body.id_admision, 'invalid_body') } : {}),
    ...(hasCons ? { id_consulta: assertPositiveId(body.id_consulta, 'invalid_body') } : {}),
    codigo_procedimiento: body.codigo_procedimiento.trim(),
    ...(body.id_profesional != null
      ? { id_profesional: assertPositiveId(body.id_profesional, 'invalid_body') }
      : {}),
    fecha_hora: new Date(body.fecha_hora).toISOString(),
    ...(sala !== undefined ? { sala } : {}),
    ...(hallazgos !== undefined ? { hallazgos } : {}),
    ...(complicaciones !== undefined ? { complicaciones } : {}),
    equipo: equipo as ProcedimientoBundle['equipo'],
    consumos: consumos as ProcedimientoBundle['consumos'],
  };
}

export function parseOp36Body(body: unknown): {
  id_nota_anterior?: number | null;
  contenido: string;
  turno?: string | null;
} {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (
    typeof body.contenido !== 'string' ||
    body.contenido.trim().length === 0 ||
    body.contenido.length > 10000
  ) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const out: { id_nota_anterior?: number | null; contenido: string; turno?: string | null } = {
    contenido: body.contenido.trim(),
  };
  if ('turno' in body) {
    if (body.turno === null) out.turno = null;
    else if (typeof body.turno === 'string' && ['diurno', 'nocturno'].includes(body.turno))
      out.turno = body.turno;
    else throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if ('id_nota_anterior' in body) {
    out.id_nota_anterior =
      body.id_nota_anterior === null
        ? null
        : assertPositiveId(body.id_nota_anterior, 'invalid_body');
  }
  return out;
}

export function parseAdmissionIdParam(params: { id: number }): number {
  return assertPositiveId(params.id);
}
