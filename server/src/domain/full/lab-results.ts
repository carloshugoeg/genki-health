import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export const LAB_RESULT_ROLES = ['laboratorista', 'medico'] as const;

export function assertLabResultRole(roles: readonly string[]): void {
  assertRoles(roles, LAB_RESULT_ROLES);
}

export function parseResultado(body: unknown) {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (typeof body.codigo_examen !== 'string' || !body.codigo_examen.trim()) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (body.datos === undefined) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  return {
    codigo_examen: body.codigo_examen.trim(),
    id_muestra: assertPositiveId(body.id_muestra, 'invalid_body'),
    datos: body.datos,
    ...(typeof body.observaciones === 'string' ? { observaciones: body.observaciones } : {}),
  };
}
