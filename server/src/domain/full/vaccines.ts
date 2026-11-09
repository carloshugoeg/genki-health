import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export const VACCINE_ROLES = ['medico', 'enfermeria'] as const;

export function assertVaccineRole(roles: readonly string[]): void {
  assertRoles(roles, VACCINE_ROLES);
}

export function parseDosisAplicacion(body: unknown) {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (
    typeof body.fecha_aplicacion !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_aplicacion)
  ) {
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
    id_profesional?: number;
  } = {
    fecha_aplicacion: body.fecha_aplicacion,
    lote: body.lote.trim(),
  };
  // Defaults to the authenticated user's professional (resolved in the application layer).
  if (body.id_profesional != null) {
    out.id_profesional = assertPositiveId(body.id_profesional, 'invalid_body');
  }
  if (typeof body.fabricante === 'string') out.fabricante = body.fabricante;
  if (typeof body.sitio_aplicacion === 'string') out.sitio_aplicacion = body.sitio_aplicacion;
  return out;
}

export function parseReaccion(body: unknown) {
  if (
    !isPlainObject(body) ||
    typeof body.reaccion_adversa !== 'string' ||
    !body.reaccion_adversa.trim()
  ) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return { reaccion_adversa: body.reaccion_adversa.trim() };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}

function pageParam(raw: unknown, fallback: number, max: number, name: string): number {
  if (raw === undefined || raw === '') return fallback;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new ClinicalError(
      'invalid_query',
      `Parámetro '${name}' inválido: use un entero entre 1 y ${max}`,
    );
  }
  return n;
}

/**
 * OP-47 query. `hasta` (AAAA-MM-DD) defaults to today's date; `page` defaults to 1;
 * `page_size` defaults to 20 (max 100).
 */
export function parsePendientesQuery(
  query: unknown,
  today: string,
): { hasta: string; page: number; page_size: number } {
  const q = isPlainObject(query) ? query : {};
  const hasta = q.hasta === undefined || q.hasta === '' ? today : q.hasta;
  if (typeof hasta !== 'string' || !isCalendarDate(hasta)) {
    throw new ClinicalError(
      'invalid_query',
      "Parámetro 'hasta' inválido: use una fecha AAAA-MM-DD (por defecto, hoy)",
    );
  }
  return {
    hasta,
    page: pageParam(q.page, 1, 10000, 'page'),
    page_size: pageParam(q.page_size, 20, 100, 'page_size'),
  };
}
