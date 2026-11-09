import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export const MILESTONE_ROLES = ['medico', 'enfermeria'] as const;

export function assertMilestoneRole(roles: readonly string[]): void {
  assertRoles(roles, MILESTONE_ROLES);
}

export function parseHitoBody(body: unknown) {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (typeof body.alcanzado !== 'boolean') throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (typeof body.fecha_evaluacion !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_evaluacion)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const out: { alcanzado: boolean; fecha_evaluacion: string; observacion?: string | null } = {
    alcanzado: body.alcanzado,
    fecha_evaluacion: body.fecha_evaluacion,
  };
  if ('observacion' in body) {
    out.observacion = body.observacion === null ? null : String(body.observacion);
  }
  return out;
}

export function parseHitoParams(params: { id: number; hito: number }) {
  return { id: assertPositiveId(params.id), hito: assertPositiveId(params.hito) };
}
