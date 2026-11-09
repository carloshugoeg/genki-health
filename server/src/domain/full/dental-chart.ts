import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export const DENTAL_ROLES = ['odontologo'] as const;
const ESTADOS = [
  'sana',
  'caries',
  'obturada',
  'ausente',
  'corona',
  'implante',
  'endodoncia',
] as const;

export function assertDentalRole(roles: readonly string[]): void {
  assertRoles(roles, DENTAL_ROLES);
}

export function parseOdontogramaBody(body: unknown) {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  return {
    id_profesional: assertPositiveId(body.id_profesional, 'invalid_body'),
    ...(typeof body.observacion_general === 'string'
      ? { observacion_general: body.observacion_general }
      : {}),
  };
}

export function parsePiezaPatch(body: unknown) {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (typeof body.estado !== 'string' || !(ESTADOS as readonly string[]).includes(body.estado)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (typeof body.movilidad !== 'number' || body.movilidad < 0 || body.movilidad > 3) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (typeof body.expected_revision !== 'number' || body.expected_revision < 0) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return {
    estado: body.estado as (typeof ESTADOS)[number],
    superficies: (isPlainObject(body.superficies) ? body.superficies : {}) as Partial<
      Record<string, string>
    >,
    movilidad: body.movilidad as 0 | 1 | 2 | 3,
    expected_revision: body.expected_revision,
    ...(typeof body.observacion === 'string' ? { observacion: body.observacion } : {}),
  };
}

export const FDI_TEETH = [
  11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48,
] as const;
