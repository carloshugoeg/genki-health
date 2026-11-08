import { ClinicalError } from '../clinical-error.js';

export const ANTECEDENTE_TIPOS = ['personal', 'familiar', 'quirurgico', 'habito'] as const;
export type AntecedenteTipo = (typeof ANTECEDENTE_TIPOS)[number];

export const ALERGIA_TIPOS = ['medicamento', 'alimento', 'ambiental', 'otro'] as const;
export type AlergiaTipo = (typeof ALERGIA_TIPOS)[number];

export const ALERGIA_SEVERIDADES = ['leve', 'moderada', 'severa'] as const;
export type AlergiaSeveridad = (typeof ALERGIA_SEVERIDADES)[number];

export const RECORD_CLINICAL_ROLES = ['medico', 'odontologo', 'enfermeria'] as const;
export const RECORD_ARCHIVE_ROLES = ['administrador', 'recepcion'] as const;

export const ARCHIVE_MOTIVOS = [
  'traslado',
  'fallecimiento',
  'administrativo',
  'inactividad',
] as const;
export type ArchiveMotivo = (typeof ARCHIVE_MOTIVOS)[number];

/** Domain-local. Mirrors Input<ANTECEDENTE> without importing @genki/shared. */
export interface ValidateAntecedenteInput {
  tipo: AntecedenteTipo;
  descripcion: string;
  fecha_inicio?: string | null;
  vigente: boolean;
}

/** Domain-local. Mirrors Input<ALERGIA> without importing @genki/shared. */
export interface ValidateAlergiaInput {
  sustancia: string;
  tipo: AlergiaTipo;
  severidad: AlergiaSeveridad;
  reaccion?: string | null;
  fecha_deteccion?: string | null;
}

/** Domain-local. Mirrors ArchiveRequest without importing @genki/shared. */
export interface ValidateArchiveInput {
  motivo_archivo: ArchiveMotivo;
  observacion_archivo?: string;
}

const ANTECEDENTE_KEYS = new Set(['tipo', 'descripcion', 'fecha_inicio', 'vigente']);
const ALERGIA_KEYS = new Set(['sustancia', 'tipo', 'severidad', 'reaccion', 'fecha_deteccion']);
const ARCHIVE_KEYS = new Set(['motivo_archivo', 'observacion_archivo']);

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

function assertOptionalDate(
  value: unknown,
  nowIso: string,
  fieldPresent: boolean,
): string | null | undefined {
  if (!fieldPresent) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const today = nowIso.slice(0, 10);
  if (value > today) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return value;
}

function assertBoundedText(
  value: unknown,
  max: number,
  opts: { allowEmpty?: boolean } = {},
): string {
  if (typeof value !== 'string') {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const trimmed = value.trim();
  if (trimmed.includes('\u0000')) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (!opts.allowEmpty && trimmed.length === 0) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (trimmed.length > max) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return trimmed;
}

export function normalizeSustancia(value: string): string {
  return value.trim().toUpperCase();
}

export function assertRecordClinicalRole(roles: readonly string[]): void {
  if (!roles.some((role) => (RECORD_CLINICAL_ROLES as readonly string[]).includes(role))) {
    throw new ClinicalError('forbidden', 'No autorizado');
  }
}

export function assertRecordArchiveRole(roles: readonly string[]): void {
  if (!roles.some((role) => (RECORD_ARCHIVE_ROLES as readonly string[]).includes(role))) {
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

  const descripcion = assertBoundedText(body.descripcion, 300);

  if (typeof body.vigente !== 'boolean') {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }

  const fecha_inicio = assertOptionalDate(body.fecha_inicio, nowIso, 'fecha_inicio' in body);

  return {
    tipo: tipo as AntecedenteTipo,
    descripcion,
    vigente: body.vigente,
    ...(fecha_inicio !== undefined ? { fecha_inicio } : {}),
  };
}

export function parseAlergiaInput(body: unknown, nowIso: string): ValidateAlergiaInput {
  if (!isPlainObject(body)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  assertNoUnknownKeys(body, ALERGIA_KEYS);

  const sustancia = assertBoundedText(body.sustancia, 120);
  if (normalizeSustancia(sustancia).length === 0) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }

  const tipo = body.tipo;
  if (typeof tipo !== 'string' || !(ALERGIA_TIPOS as readonly string[]).includes(tipo)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }

  const severidad = body.severidad;
  if (
    typeof severidad !== 'string' ||
    !(ALERGIA_SEVERIDADES as readonly string[]).includes(severidad)
  ) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }

  let reaccion: string | null | undefined = undefined;
  if ('reaccion' in body) {
    if (body.reaccion === null) {
      reaccion = null;
    } else {
      reaccion = assertBoundedText(body.reaccion, 200, { allowEmpty: true });
    }
  }

  const fecha_deteccion = assertOptionalDate(
    body.fecha_deteccion,
    nowIso,
    'fecha_deteccion' in body,
  );

  return {
    sustancia,
    tipo: tipo as AlergiaTipo,
    severidad: severidad as AlergiaSeveridad,
    ...(reaccion !== undefined ? { reaccion } : {}),
    ...(fecha_deteccion !== undefined ? { fecha_deteccion } : {}),
  };
}

export function parseArchiveInput(body: unknown): ValidateArchiveInput {
  if (!isPlainObject(body)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  assertNoUnknownKeys(body, ARCHIVE_KEYS);

  const motivo = body.motivo_archivo;
  if (typeof motivo !== 'string' || !(ARCHIVE_MOTIVOS as readonly string[]).includes(motivo)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }

  let observacion_archivo: string | undefined = undefined;
  if ('observacion_archivo' in body) {
    if (body.observacion_archivo === undefined) {
      observacion_archivo = undefined;
    } else if (typeof body.observacion_archivo !== 'string') {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    } else {
      const trimmed = body.observacion_archivo.trim();
      if (trimmed.includes('\u0000') || trimmed.length > 500) {
        throw new ClinicalError('invalid_body', 'Solicitud inválida');
      }
      observacion_archivo = trimmed;
    }
  }

  return {
    motivo_archivo: motivo as ArchiveMotivo,
    ...(observacion_archivo !== undefined ? { observacion_archivo } : {}),
  };
}

export function parseOp15Params(params: { id: number }): number {
  return assertPositiveId(params?.id, 'invalid_body');
}

export function parseOp16Params(params: { id: number }): number {
  return assertPositiveId(params?.id, 'invalid_body');
}

export function parseOp18Params(params: { id: number }): number {
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
