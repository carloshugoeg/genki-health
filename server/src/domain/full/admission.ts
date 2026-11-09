import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export const ADMISSION_ROLES = ['medico', 'enfermeria', 'administrador'] as const;

export function assertAdmissionRole(roles: readonly string[]): void {
  assertRoles(roles, ADMISSION_ROLES);
}

export function parseOp34Query(query: Record<string, unknown>): { id_servicio?: number } {
  if (query.id_servicio === undefined) return {};
  const raw = query.id_servicio;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return { id_servicio: assertPositiveId(n, 'invalid_query') };
}

export function parseOp35Body(body: unknown): {
  id_consulta_origen?: number | null;
  id_cama: number;
  id_diagnostico_ingreso: number;
  tipo_ingreso: string;
  fecha_hora_ingreso: string;
} {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  const tipo = body.tipo_ingreso;
  if (typeof tipo !== 'string' || !['emergencia', 'electiva', 'traslado'].includes(tipo)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (typeof body.fecha_hora_ingreso !== 'string' || !body.fecha_hora_ingreso.endsWith('Z')) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const out: {
    id_consulta_origen?: number | null;
    id_cama: number;
    id_diagnostico_ingreso: number;
    tipo_ingreso: string;
    fecha_hora_ingreso: string;
  } = {
    id_cama: assertPositiveId(body.id_cama, 'invalid_body'),
    id_diagnostico_ingreso: assertPositiveId(body.id_diagnostico_ingreso, 'invalid_body'),
    tipo_ingreso: tipo,
    fecha_hora_ingreso: body.fecha_hora_ingreso,
  };
  if ('id_consulta_origen' in body) {
    out.id_consulta_origen =
      body.id_consulta_origen === null
        ? null
        : assertPositiveId(body.id_consulta_origen, 'invalid_body');
  }
  return out;
}

export function parsePatientIdParam(params: { id: number }): number {
  return assertPositiveId(params.id);
}
