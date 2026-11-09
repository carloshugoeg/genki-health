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

export function parseOp37Body(body: unknown): ProcedimientoBundle {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  const hasAdm = body.id_admision != null;
  const hasCons = body.id_consulta != null;
  if (hasAdm === hasCons) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (typeof body.codigo_procedimiento !== 'string' || body.codigo_procedimiento.trim().length < 1) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (typeof body.fecha_hora !== 'string' || body.fecha_hora.length < 10) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (!Array.isArray(body.equipo) || !Array.isArray(body.consumos)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return {
    ...(hasAdm ? { id_admision: assertPositiveId(body.id_admision, 'invalid_body') } : {}),
    ...(hasCons ? { id_consulta: assertPositiveId(body.id_consulta, 'invalid_body') } : {}),
    codigo_procedimiento: body.codigo_procedimiento.trim(),
    id_profesional: assertPositiveId(body.id_profesional, 'invalid_body'),
    fecha_hora: body.fecha_hora,
    ...(typeof body.sala === 'string' ? { sala: body.sala } : {}),
    ...(typeof body.hallazgos === 'string' ? { hallazgos: body.hallazgos } : {}),
    ...(typeof body.complicaciones === 'string' ? { complicaciones: body.complicaciones } : {}),
    equipo: body.equipo as ProcedimientoBundle['equipo'],
    consumos: body.consumos as ProcedimientoBundle['consumos'],
  };
}

export function parseOp36Body(body: unknown): {
  id_nota_anterior?: number | null;
  contenido: string;
  turno?: string | null;
} {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (typeof body.contenido !== 'string' || body.contenido.trim().length === 0 || body.contenido.length > 10000) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const out: { id_nota_anterior?: number | null; contenido: string; turno?: string | null } = {
    contenido: body.contenido.trim(),
  };
  if ('turno' in body) {
    if (body.turno === null) out.turno = null;
    else if (typeof body.turno === 'string' && ['diurno', 'nocturno'].includes(body.turno)) out.turno = body.turno;
    else throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if ('id_nota_anterior' in body) {
    out.id_nota_anterior =
      body.id_nota_anterior === null ? null : assertPositiveId(body.id_nota_anterior, 'invalid_body');
  }
  return out;
}

export function parseAdmissionIdParam(params: { id: number }): number {
  return assertPositiveId(params.id);
}
