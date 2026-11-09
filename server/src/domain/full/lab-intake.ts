import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export const LAB_INTAKE_ROLES = ['laboratorista', 'medico', 'administrador'] as const;

export function assertLabIntakeRole(roles: readonly string[]): void {
  assertRoles(roles, LAB_INTAKE_ROLES);
}

export function parseLabOrder(body: unknown) {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (!Array.isArray(body.examenes) || body.examenes.length === 0) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (body.prioridad !== 'rutina' && body.prioridad !== 'urgente') {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (typeof body.medico_solicitante !== 'string' || !body.medico_solicitante.trim()) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return {
    id_paciente: assertPositiveId(body.id_paciente, 'invalid_body'),
    institucion_origen: assertPositiveId(body.institucion_origen, 'invalid_body'),
    medico_solicitante: body.medico_solicitante.trim(),
    prioridad: body.prioridad as 'rutina' | 'urgente',
    examenes: body.examenes.map(String),
    ...(typeof body.observaciones === 'string' ? { observaciones: body.observaciones } : {}),
    ...(typeof body.referencia_externa === 'string'
      ? { referencia_externa: body.referencia_externa }
      : {}),
  };
}

export function parseMuestra(body: unknown) {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  for (const key of ['codigo_barras', 'tipo_muestra', 'fecha_hora_toma', 'condicion'] as const) {
    if (typeof body[key] !== 'string' || !(body[key] as string).trim()) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
  }
  return {
    codigo_barras: String(body.codigo_barras).trim(),
    tipo_muestra: String(body.tipo_muestra).trim(),
    fecha_hora_toma: String(body.fecha_hora_toma),
    condicion: String(body.condicion).trim(),
    responsable_toma: assertPositiveId(body.responsable_toma, 'invalid_body'),
  };
}
