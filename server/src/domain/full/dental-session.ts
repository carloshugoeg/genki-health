import type { SesionInput } from '@genki/shared/full/dental-session';
import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export const DENTAL_SESSION_ROLES = ['odontologo'] as const;

export function assertDentalSessionRole(roles: readonly string[]): void {
  assertRoles(roles, DENTAL_SESSION_ROLES);
}

export function parseSesionInput(body: unknown): SesionInput {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (typeof body.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (!Array.isArray(body.lineas) || body.lineas.length < 1) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (
    typeof body.expected_revision !== 'number' ||
    !Number.isInteger(body.expected_revision) ||
    body.expected_revision < 0
  ) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return {
    fecha: body.fecha,
    lineas: body.lineas.map((line) => assertPositiveId(line, 'invalid_body')),
    expected_revision: body.expected_revision,
    ...(body.id_cita != null ? { id_cita: assertPositiveId(body.id_cita, 'invalid_body') } : {}),
    ...(typeof body.anestesia_utilizada === 'string'
      ? { anestesia_utilizada: body.anestesia_utilizada }
      : {}),
    ...(typeof body.observaciones === 'string' ? { observaciones: body.observaciones } : {}),
  };
}

export function parsePatientIdParam(params: { id: number }): number {
  return assertPositiveId(params.id);
}

export function parsePlanIdParam(params: { id: number }): number {
  return assertPositiveId(params.id);
}
