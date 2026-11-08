import { ClinicalError } from '../clinical-error.js';

const GT_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 31 * DAY_MS;
const SLOT_MINUTES = 30;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 17;

export const AGENDA_ALLOWED_ROLES = ['recepcion', 'secretaria', 'caja'] as const;

export type BusyInterval = {
  inicio: string;
  fin: string;
  estado: string;
};

export type GeneratedSlot = {
  id_profesional: number;
  inicio: string;
  fin: string;
};

const FREEING_STATES = new Set(['cancelada', 'no_asistio']);

export function assertAgendaRole(roles: readonly string[]): void {
  const ok = roles.some((role) => (AGENDA_ALLOWED_ROLES as readonly string[]).includes(role));
  if (!ok) {
    throw new ClinicalError('forbidden', 'Rol no autorizado para agenda');
  }
}

export function isBlockingEstado(estado: string): boolean {
  return !FREEING_STATES.has(estado);
}

export function intervalEndIso(inicio: string, duracionMinutos: number): string {
  return new Date(Date.parse(inicio) + duracionMinutos * 60_000).toISOString();
}

export function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return Date.parse(aStart) < Date.parse(bEnd) && Date.parse(aEnd) > Date.parse(bStart);
}

function assertIsoUtc(
  value: unknown,
  code: 'invalid_query' | 'invalid_body',
  label: string,
): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ClinicalError(code, `${label} debe ser ISO UTC`);
  }
  if (!/Z$/i.test(value) && !/[+-]\d{2}:\d{2}$/.test(value)) {
    throw new ClinicalError(code, `${label} debe ser ISO UTC`);
  }
  return new Date(value).toISOString();
}

function assertPositiveInt(
  value: unknown,
  code: 'invalid_query' | 'invalid_body',
  label: string,
): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ClinicalError(code, `${label} inválido`);
  }
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  code: 'invalid_query' | 'invalid_body',
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new ClinicalError(code, `Campo no permitido: ${key}`);
    }
  }
}

export function parseOp20Query(query: Record<string, unknown>): {
  id_profesional: number;
  desde: string;
  hasta: string;
} {
  assertExactKeys(query, ['id_profesional', 'desde', 'hasta'], 'invalid_query');
  const id_profesional = assertPositiveInt(query.id_profesional, 'invalid_query', 'id_profesional');
  const desde = assertIsoUtc(query.desde, 'invalid_query', 'desde');
  const hasta = assertIsoUtc(query.hasta, 'invalid_query', 'hasta');
  const span = Date.parse(hasta) - Date.parse(desde);
  if (!(span > 0)) {
    throw new ClinicalError('invalid_query', 'Rango de disponibilidad inválido');
  }
  if (span > MAX_RANGE_MS) {
    throw new ClinicalError('invalid_query', 'Rango de disponibilidad excede 31 días');
  }
  return { id_profesional, desde, hasta };
}

export function parseOp21Body(body: Record<string, unknown>): {
  id_paciente: number;
  id_profesional: number;
  id_especialidad: number | null;
  fecha_hora: string;
  duracion_minutos: number;
  motivo: string | null;
} {
  assertExactKeys(
    body,
    [
      'id_paciente',
      'id_profesional',
      'id_especialidad',
      'fecha_hora',
      'duracion_minutos',
      'motivo',
    ],
    'invalid_body',
  );
  const id_paciente = assertPositiveInt(body.id_paciente, 'invalid_body', 'id_paciente');
  const id_profesional = assertPositiveInt(body.id_profesional, 'invalid_body', 'id_profesional');
  let id_especialidad: number | null = null;
  if (body.id_especialidad !== undefined && body.id_especialidad !== null) {
    id_especialidad = assertPositiveInt(body.id_especialidad, 'invalid_body', 'id_especialidad');
  }
  const fecha_hora = assertIsoUtc(body.fecha_hora, 'invalid_body', 'fecha_hora');
  const duracion_minutos = assertPositiveInt(
    body.duracion_minutos,
    'invalid_body',
    'duracion_minutos',
  );
  if (duracion_minutos < 1 || duracion_minutos > 480) {
    throw new ClinicalError('invalid_body', 'duracion_minutos fuera de rango');
  }
  let motivo: string | null = null;
  if (body.motivo !== undefined && body.motivo !== null) {
    if (typeof body.motivo !== 'string') {
      throw new ClinicalError('invalid_body', 'motivo inválido');
    }
    const trimmed = body.motivo.trim();
    if (trimmed.includes('\u0000') || trimmed.length > 200) {
      throw new ClinicalError('invalid_body', 'motivo inválido');
    }
    motivo = trimmed.length === 0 ? null : trimmed;
  }
  return {
    id_paciente,
    id_profesional,
    id_especialidad,
    fecha_hora,
    duracion_minutos,
    motivo,
  };
}

const RESCHEDULABLE = new Set(['programada', 'confirmada']);
const CANCELLABLE = new Set(['programada', 'confirmada']);

export function parseOp22Params(params: Record<string, unknown>): { id: number } {
  assertExactKeys(params, ['id'], 'invalid_body');
  return { id: assertPositiveInt(params.id, 'invalid_body', 'id') };
}

export function parseOp22Body(body: Record<string, unknown>): {
  fecha_hora: string;
  duracion_minutos: number;
} {
  assertExactKeys(body, ['fecha_hora', 'duracion_minutos'], 'invalid_body');
  const fecha_hora = assertIsoUtc(body.fecha_hora, 'invalid_body', 'fecha_hora');
  const duracion_minutos = assertPositiveInt(
    body.duracion_minutos,
    'invalid_body',
    'duracion_minutos',
  );
  if (duracion_minutos < 1 || duracion_minutos > 480) {
    throw new ClinicalError('invalid_body', 'duracion_minutos fuera de rango');
  }
  return { fecha_hora, duracion_minutos };
}

export function parseOp23Params(params: Record<string, unknown>): { id: number } {
  assertExactKeys(params, ['id'], 'invalid_body');
  return { id: assertPositiveInt(params.id, 'invalid_body', 'id') };
}

export function parseOp23Body(body: Record<string, unknown>): { motivo: string } {
  assertExactKeys(body, ['motivo'], 'invalid_body');
  if (typeof body.motivo !== 'string') {
    throw new ClinicalError('invalid_body', 'motivo inválido');
  }
  const trimmed = body.motivo.trim();
  if (trimmed.length === 0 || trimmed.includes('\u0000') || trimmed.length > 200) {
    throw new ClinicalError('invalid_body', 'motivo inválido');
  }
  return { motivo: trimmed };
}

export function assertReschedulableEstado(estado: string): void {
  if (!RESCHEDULABLE.has(estado)) {
    throw new ClinicalError('conflict', 'La cita no admite reprogramación');
  }
}

export function assertCancellableEstado(estado: string): void {
  if (!CANCELLABLE.has(estado)) {
    throw new ClinicalError('conflict', 'La cita no admite cancelación');
  }
}

export function assertNotInPast(fecha_hora: string, nowIso: string): void {
  if (Date.parse(fecha_hora) < Date.parse(nowIso)) {
    throw new ClinicalError('invalid_body', 'No se puede agendar en el pasado');
  }
}

export function assertNoOverlap(inicio: string, fin: string, busy: readonly BusyInterval[]): void {
  for (const row of busy) {
    if (!isBlockingEstado(row.estado)) {
      continue;
    }
    if (intervalsOverlap(inicio, fin, row.inicio, row.fin)) {
      throw new ClinicalError('conflict', 'Horario no disponible');
    }
  }
}

type GtParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

function gtPartsFromUtcMs(utcMs: number): GtParts {
  const shifted = new Date(utcMs - GT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

function utcMsFromGtLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  return Date.UTC(year, month, day, hour, minute) + GT_OFFSET_MS;
}

function startOfGtDayUtcMs(parts: GtParts): number {
  return utcMsFromGtLocal(parts.year, parts.month, parts.day, 0, 0);
}

export function generateAvailableSlots(
  id_profesional: number,
  desdeIso: string,
  hastaIso: string,
  busy: readonly BusyInterval[],
): GeneratedSlot[] {
  const desdeMs = Date.parse(desdeIso);
  const hastaMs = Date.parse(hastaIso);
  const startParts = gtPartsFromUtcMs(desdeMs);
  let cursorDay = startOfGtDayUtcMs(startParts);
  const endDay = startOfGtDayUtcMs(gtPartsFromUtcMs(hastaMs - 1));
  const slots: GeneratedSlot[] = [];

  while (cursorDay <= endDay) {
    const day = gtPartsFromUtcMs(cursorDay);
    if (day.weekday !== 0) {
      for (
        let mins = DAY_START_HOUR * 60;
        mins <= (DAY_END_HOUR - 1) * 60 + SLOT_MINUTES;
        mins += SLOT_MINUTES
      ) {
        const hour = Math.floor(mins / 60);
        const minute = mins % 60;
        const startMs = utcMsFromGtLocal(day.year, day.month, day.day, hour, minute);
        const endMs = startMs + SLOT_MINUTES * 60_000;
        if (startMs < desdeMs || endMs > hastaMs) {
          continue;
        }
        const inicio = new Date(startMs).toISOString();
        const fin = new Date(endMs).toISOString();
        let blocked = false;
        for (const row of busy) {
          if (!isBlockingEstado(row.estado)) {
            continue;
          }
          if (intervalsOverlap(inicio, fin, row.inicio, row.fin)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          slots.push({ id_profesional, inicio, fin });
        }
      }
    }
    cursorDay += DAY_MS;
  }

  return slots;
}

export function guatemalaDateKey(fechaHoraIso: string): string {
  const parts = gtPartsFromUtcMs(Date.parse(fechaHoraIso));
  const month = String(parts.month + 1).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

export function lockKeysForInterval(inicio: string, fin: string): string[] {
  const keys: string[] = [];
  const startParts = gtPartsFromUtcMs(Date.parse(inicio));
  let cursor = startOfGtDayUtcMs(startParts);
  const endExclusive = Date.parse(fin);
  while (cursor < endExclusive) {
    const parts = gtPartsFromUtcMs(cursor);
    keys.push(
      `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    );
    cursor += DAY_MS;
  }
  return keys;
}
