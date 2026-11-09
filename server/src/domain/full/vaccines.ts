import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export const VACCINE_ROLES = ['medico', 'enfermeria'] as const;

export function assertVaccineRole(roles: readonly string[]): void {
  assertRoles(roles, VACCINE_ROLES);
}

export function parseDosisAplicacion(body: unknown) {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (typeof body.fecha_aplicacion !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_aplicacion)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (typeof body.lote !== 'string' || body.lote.trim().length === 0) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const out: {
    fecha_aplicacion: string;
    lote: string;
    fabricante?: string;
    sitio_aplicacion?: string;
    id_profesional: number;
  } = {
    fecha_aplicacion: body.fecha_aplicacion,
    lote: body.lote.trim(),
    id_profesional: assertPositiveId(body.id_profesional, 'invalid_body'),
  };
  if (typeof body.fabricante === 'string') out.fabricante = body.fabricante;
  if (typeof body.sitio_aplicacion === 'string') out.sitio_aplicacion = body.sitio_aplicacion;
  return out;
}

export function parseReaccion(body: unknown) {
  if (!isPlainObject(body) || typeof body.reaccion_adversa !== 'string' || !body.reaccion_adversa.trim()) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return { reaccion_adversa: body.reaccion_adversa.trim() };
}
