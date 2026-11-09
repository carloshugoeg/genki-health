import type { CITA, CITAInput } from '@genki/shared/full/agenda';
import { ClinicalError } from '../clinical-error.js';

export const GUATEMALA_OFFSET_MS = 6 * 60 * 60 * 1000;
export interface AgendaHours {
  startHour: number;
  endHour: number;
  slotMinutes: number;
}
/** Academic configurable default, not an asserted source fact. Local Guatemala Mon–Sat. */
export const DEFAULT_AGENDA_HOURS: AgendaHours = { startHour: 8, endHour: 17, slotMinutes: 30 };
export function invalid(code: 'invalid_query' | 'invalid_body' | 'conflict' = 'conflict'): never {
  throw new ClinicalError(
    code,
    code === 'conflict'
      ? 'La cita no permite esta operación o el intervalo está ocupado'
      : 'Parámetros de agenda inválidos',
  );
}
export function positiveId(
  value: number,
  code: 'invalid_query' | 'invalid_body' = 'invalid_body',
): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) invalid(code);
  return value;
}
export function instant(
  value: string,
  code: 'invalid_query' | 'invalid_body' = 'invalid_body',
): number {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    invalid(code);
  const datePart = value.slice(0, 10);
  if (new Date(`${datePart}T00:00:00Z`).toISOString().slice(0, 10) !== datePart) invalid(code);
  return Date.parse(value);
}
export function interval(fecha: string, minutes: number): [number, number] {
  const start = instant(fecha);
  if (!Number.isSafeInteger(minutes) || minutes <= 0 || minutes > 32767) invalid('invalid_body');
  const end = start + minutes * 60000;
  if (!Number.isSafeInteger(end) || Math.abs(end) > 8640000000000000) invalid('invalid_body');
  return [start, end];
}
export function dayBounds(day: string): [number, number] {
  if (typeof day !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(day)) invalid('invalid_query');
  const start = Date.parse(`${day}T06:00:00Z`);
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== day)
    invalid('invalid_query');
  return [start, start + 86400000];
}
export function active(cita: CITA): boolean {
  return !['cancelada', 'no_asistio'].includes(cita.estado);
}
export function overlaps(a: readonly number[], b: readonly number[]): boolean {
  return a[0]! < b[1]! && b[0]! < a[1]!;
}
export function assertFree(rows: CITA[], input: CITAInput, exclude?: number): void {
  const range = interval(input.fecha_hora, input.duracion_minutos);
  if (
    rows.some(
      (c) =>
        c.id_cita !== exclude &&
        c.id_profesional === input.id_profesional &&
        active(c) &&
        overlaps(range, interval(c.fecha_hora, c.duracion_minutos)),
    )
  )
    invalid();
}
export function validateBooking(input: CITAInput): void {
  positiveId(input.id_paciente);
  positiveId(input.id_profesional);
  if (input.id_especialidad != null) positiveId(input.id_especialidad);
  interval(input.fecha_hora, input.duracion_minutos);
  if (input.motivo != null && (typeof input.motivo !== 'string' || input.motivo.length > 200))
    invalid('invalid_body');
}
export function lockKeys(
  institution: number,
  input: Pick<CITAInput, 'fecha_hora' | 'duracion_minutos' | 'id_profesional'>,
): string[] {
  const [start, end] = interval(input.fecha_hora, input.duracion_minutos);
  const keys: string[] = [];
  for (
    let time = Math.floor((start - GUATEMALA_OFFSET_MS) / 86400000) * 86400000;
    time < end - GUATEMALA_OFFSET_MS;
    time += 86400000
  )
    keys.push(
      `${institution}/${input.id_profesional}/${new Date(time).toISOString().slice(0, 10)}`,
    );
  return keys;
}
export function clinicalProjection(cita: CITA, roles: readonly string[]): CITA {
  if (roles.some((r) => ['medico', 'odontologo', 'enfermeria', 'laboratorista'].includes(r)))
    return { ...cita };
  const safe = { ...cita };
  delete safe.motivo;
  return safe;
}
