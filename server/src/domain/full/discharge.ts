import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export const DISCHARGE_ROLES = ['medico'] as const;

export function assertDischargeRole(roles: readonly string[]): void {
  assertRoles(roles, DISCHARGE_ROLES);
}

export function parseOp38Body(body: unknown): {
  id_diagnostico_egreso: number;
  condicion_egreso: string;
  fecha_hora_egreso: string;
} {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  const cond = body.condicion_egreso;
  if (
    typeof cond !== 'string' ||
    !['mejorado', 'igual', 'empeorado', 'fallecido', 'traslado'].includes(cond)
  ) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (typeof body.fecha_hora_egreso !== 'string' || !body.fecha_hora_egreso.endsWith('Z')) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return {
    id_diagnostico_egreso: assertPositiveId(body.id_diagnostico_egreso, 'invalid_body'),
    condicion_egreso: cond,
    fecha_hora_egreso: body.fecha_hora_egreso,
  };
}
