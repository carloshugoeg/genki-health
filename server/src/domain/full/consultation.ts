import { ClinicalError } from '../clinical-error.js';
import { assertRoles } from './specialty-common.js';

export const CONSULTATION_OPEN_ROLES = ['medico', 'odontologo'] as const;
export const CONSULTATION_VITALS_ROLES = ['medico', 'enfermeria', 'odontologo'] as const;

export const CONSULTA_TIPOS = ['primera_vez', 'seguimiento', 'emergencia'] as const;
export type ConsultaTipo = (typeof CONSULTA_TIPOS)[number];

/** Domain-local. Mirrors OpenConsultaInput without importing @genki/shared. */
export interface ValidateOpenConsultaInput {
  /** Optional: the acting user's USUARIO.id_profesional wins (see resolveActingProfesional). */
  id_profesional?: number;
  id_cita?: number | null;
  tipo: ConsultaTipo;
  motivo_consulta: string;
  fecha_hora_inicio: string;
}

/** Domain-local. Mirrors SIGNOS_VITALESInput. */
export interface ValidateSignosVitalesInput {
  presion_sistolica?: number | null;
  presion_diastolica?: number | null;
  frecuencia_cardiaca?: number | null;
  frecuencia_respiratoria?: number | null;
  temperatura_c?: number | null;
  saturacion_oxigeno?: number | null;
  peso_kg?: number | null;
  talla_cm?: number | null;
}

const OPEN_KEYS = new Set([
  'id_profesional',
  'id_cita',
  'tipo',
  'motivo_consulta',
  'fecha_hora_inicio',
]);
const SIGNOS_KEYS = new Set([
  'presion_sistolica',
  'presion_diastolica',
  'frecuencia_cardiaca',
  'frecuencia_respiratoria',
  'temperatura_c',
  'saturacion_oxigeno',
  'peso_kg',
  'talla_cm',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNoUnknownKeys(body: Record<string, unknown>, allowed: Set<string>): void {
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
  }
}

function assertPositiveId(value: unknown, code: 'invalid_query' | 'invalid_body'): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new ClinicalError(code, 'Solicitud inválida');
  }
  return value;
}

function assertBoundedText(value: unknown, max: number): string {
  if (typeof value !== 'string') {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.includes('\u0000') || trimmed.length > max) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return trimmed;
}

function assertIsoDateTime(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return value;
}

function assertOptionalInt(
  value: unknown,
  min: number,
  max: number,
  present: boolean,
): number | null | undefined {
  if (!present) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return value;
}

function assertOptionalNumber(
  value: unknown,
  min: number,
  max: number,
  present: boolean,
): number | null | undefined {
  if (!present) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return value;
}

function assertOptionalPositive(value: unknown, present: boolean): number | null | undefined {
  if (!present) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return value;
}

export function assertConsultationOpenRole(roles: readonly string[]): void {
  assertRoles(roles, CONSULTATION_OPEN_ROLES);
}

export function assertConsultationVitalsRole(roles: readonly string[]): void {
  assertRoles(roles, CONSULTATION_VITALS_ROLES);
}

export function parseOp26Params(params: { id: number }): number {
  return assertPositiveId(params?.id, 'invalid_query');
}

export function parseOp27Params(params: { id: number }): number {
  return assertPositiveId(params?.id, 'invalid_query');
}

export function parseOpenConsultaInput(body: unknown): ValidateOpenConsultaInput {
  if (!isPlainObject(body)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  assertNoUnknownKeys(body, OPEN_KEYS);

  const id_profesional =
    body.id_profesional === undefined
      ? undefined
      : assertPositiveId(body.id_profesional, 'invalid_body');
  const tipo = body.tipo;
  if (typeof tipo !== 'string' || !(CONSULTA_TIPOS as readonly string[]).includes(tipo)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const motivo_consulta = assertBoundedText(body.motivo_consulta, 300);
  const fecha_hora_inicio = assertIsoDateTime(body.fecha_hora_inicio);

  let id_cita: number | null | undefined = undefined;
  if ('id_cita' in body) {
    if (body.id_cita === null) {
      id_cita = null;
    } else {
      id_cita = assertPositiveId(body.id_cita, 'invalid_body');
    }
  }

  return {
    ...(id_profesional !== undefined ? { id_profesional } : {}),
    tipo: tipo as ConsultaTipo,
    motivo_consulta,
    fecha_hora_inicio,
    ...(id_cita !== undefined ? { id_cita } : {}),
  };
}

/** Bounds from source §5.1 / entities.json. */
export function parseSignosVitalesInput(body: unknown): ValidateSignosVitalesInput {
  if (!isPlainObject(body)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  assertNoUnknownKeys(body, SIGNOS_KEYS);

  const out: ValidateSignosVitalesInput = {};
  if ('presion_sistolica' in body) {
    out.presion_sistolica = assertOptionalInt(body.presion_sistolica, 50, 300, true) ?? null;
  }
  if ('presion_diastolica' in body) {
    out.presion_diastolica = assertOptionalInt(body.presion_diastolica, 30, 200, true) ?? null;
  }
  if ('frecuencia_cardiaca' in body) {
    out.frecuencia_cardiaca = assertOptionalInt(body.frecuencia_cardiaca, 20, 250, true) ?? null;
  }
  if ('frecuencia_respiratoria' in body) {
    out.frecuencia_respiratoria =
      assertOptionalInt(body.frecuencia_respiratoria, 5, 80, true) ?? null;
  }
  if ('temperatura_c' in body) {
    out.temperatura_c = assertOptionalNumber(body.temperatura_c, 30, 45, true) ?? null;
  }
  if ('saturacion_oxigeno' in body) {
    out.saturacion_oxigeno = assertOptionalInt(body.saturacion_oxigeno, 50, 100, true) ?? null;
  }
  if ('peso_kg' in body) {
    out.peso_kg = assertOptionalPositive(body.peso_kg, true) ?? null;
  }
  if ('talla_cm' in body) {
    out.talla_cm = assertOptionalPositive(body.talla_cm, true) ?? null;
  }
  return out;
}

export function requireIdempotencyKey(value: string | undefined): string {
  if (!value || typeof value !== 'string' || value.trim().length === 0 || value.length > 120) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return value.trim();
}
