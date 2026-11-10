import { ClinicalError } from '../clinical-error.js';

export const ANTECEDENTE_TIPOS = ['personal', 'familiar', 'quirurgico', 'habito'] as const;
export type AntecedenteTipo = (typeof ANTECEDENTE_TIPOS)[number];

export const RECORD_CLINICAL_ROLES = ['medico', 'odontologo', 'enfermeria'] as const;

/** Domain-local. Mirrors Input<ANTECEDENTE> without importing @genki/shared. */
export interface ValidateAntecedenteInput {
  tipo: AntecedenteTipo;
  descripcion: string;
  fecha_inicio?: string | null;
  vigente: boolean;
}

const ANTECEDENTE_KEYS = new Set(['tipo', 'descripcion', 'fecha_inicio', 'vigente']);

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

export function assertRecordClinicalRole(roles: readonly string[]): void {
  if (!roles.some((role) => (RECORD_CLINICAL_ROLES as readonly string[]).includes(role))) {
    throw new ClinicalError('forbidden', 'No autorizado');
  }
}

export function parseOp12Params(params: { id: number }, query: Record<string, unknown>): number {
  if (!isPlainObject(query) || Object.keys(query).length > 0) {
    throw new ClinicalError('invalid_query', 'Solicitud inválida');
  }
  return assertPositiveId(params?.id, 'invalid_query');
}

export function parseAntecedenteInput(body: unknown, nowIso: string): ValidateAntecedenteInput {
  if (!isPlainObject(body)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  assertNoUnknownKeys(body, ANTECEDENTE_KEYS);

  const tipo = body.tipo;
  if (typeof tipo !== 'string' || !(ANTECEDENTE_TIPOS as readonly string[]).includes(tipo)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }

  if (typeof body.descripcion !== 'string') {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const descripcion = body.descripcion.trim();
  if (descripcion.length === 0 || descripcion.length > 300 || descripcion.includes('\u0000')) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }

  if (typeof body.vigente !== 'boolean') {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }

  let fecha_inicio: string | null | undefined = undefined;
  if ('fecha_inicio' in body) {
    if (body.fecha_inicio === null) {
      fecha_inicio = null;
    } else if (typeof body.fecha_inicio === 'string') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_inicio)) {
        throw new ClinicalError('invalid_body', 'Solicitud inválida');
      }
      const today = nowIso.slice(0, 10);
      if (body.fecha_inicio > today) {
        throw new ClinicalError('invalid_body', 'Solicitud inválida');
      }
      fecha_inicio = body.fecha_inicio;
    } else {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
  }

  return {
    tipo: tipo as AntecedenteTipo,
    descripcion,
    vigente: body.vigente,
    ...(fecha_inicio !== undefined ? { fecha_inicio } : {}),
  };
}

export function parseOp15Params(params: { id: number }): number {
  return assertPositiveId(params?.id, 'invalid_body');
}

export function requireIdempotencyKey(key: string | undefined): string {
  if (typeof key !== 'string') {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const trimmed = key.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return trimmed;
}
