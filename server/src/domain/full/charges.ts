/** Pure domain rules for module `charges` (OP-68/69). No drivers/config. */

import type { CARGO, CargoCaja, CargoInput, SERVICIO_FACTURABLE } from '@genki/shared/full/charges';
import { ClinicalError } from '../clinical-error.js';

export const CARGO_ORIGENES = [
  'manual',
  'consulta',
  'procedimiento',
  'estancia',
  'insumo',
  'honorario',
  'examen',
] as const;

export type CargoOrigen = (typeof CARGO_ORIGENES)[number];

const CARGO_INPUT_KEYS = new Set([
  'id_paciente',
  'codigo_servicio',
  'origen',
  'id_consulta',
  'id_procedimiento',
  'id_admision',
  'id_consumo',
  'id_participacion',
  'cantidad',
  'clave_evento',
]);

const PAGE_QUERY_KEYS = new Set(['page', 'page_size']);

export function isPositiveInt32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 2147483647;
}

function isNonEmptyTrimmed(value: unknown, max: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    value.length <= max &&
    !value.includes('\0')
  );
}

export function parsePositiveDecimal(raw: string, maxIntDigits: number, scale: number): string {
  const re = new RegExp(`^(?:0|[1-9]\\d{0,${maxIntDigits - 1}})(?:\\.\\d{1,${scale}})?$`);
  if (!re.test(raw)) {
    throw new ClinicalError('invalid_body', 'cantidad inválida');
  }
  const n = Number(raw);
  if (!(n > 0) || !Number.isFinite(n)) {
    throw new ClinicalError('invalid_body', 'cantidad inválida');
  }
  return n.toFixed(scale);
}

export function multiplyMoney(cantidad: string, precioUnitario: string): string {
  const a = Number(cantidad);
  const b = Number(precioUnitario);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new ClinicalError('invalid_body', 'monto inválido');
  }
  return (a * b).toFixed(2);
}

export function assertCargoInputSchema(body: unknown): CargoInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!CARGO_INPUT_KEYS.has(key)) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
  }
  if (!isPositiveInt32(record.id_paciente)) {
    throw new ClinicalError('invalid_body', 'id_paciente inválido');
  }
  if (!isNonEmptyTrimmed(record.codigo_servicio, 12)) {
    throw new ClinicalError('invalid_body', 'codigo_servicio inválido');
  }
  if (
    typeof record.origen !== 'string' ||
    !(CARGO_ORIGENES as readonly string[]).includes(record.origen)
  ) {
    throw new ClinicalError('invalid_body', 'origen inválido');
  }
  if (typeof record.cantidad !== 'string') {
    throw new ClinicalError('invalid_body', 'cantidad inválida');
  }
  const cantidad = parsePositiveDecimal(record.cantidad, 8, 2);
  if (!isNonEmptyTrimmed(record.clave_evento, 80)) {
    throw new ClinicalError('invalid_body', 'clave_evento inválida');
  }

  const optionalIds = [
    'id_consulta',
    'id_procedimiento',
    'id_admision',
    'id_consumo',
    'id_participacion',
  ] as const;
  const out: CargoInput = {
    id_paciente: record.id_paciente,
    codigo_servicio: record.codigo_servicio,
    origen: record.origen as CargoOrigen,
    cantidad,
    clave_evento: record.clave_evento,
  };
  for (const key of optionalIds) {
    if (record[key] === undefined) continue;
    if (!isPositiveInt32(record[key])) {
      throw new ClinicalError('invalid_body', `${key} inválido`);
    }
    out[key] = record[key] as number;
  }
  return out;
}

export function assertPageQuerySchema(query: unknown): { page: number; page_size: number } {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) {
    throw new ClinicalError('invalid_query', 'Consulta inválida');
  }
  const record = query as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!PAGE_QUERY_KEYS.has(key)) {
      throw new ClinicalError('invalid_query', 'Consulta inválida');
    }
  }
  const page = record.page === undefined ? 1 : record.page;
  const page_size = record.page_size === undefined ? 20 : record.page_size;
  if (!isPositiveInt32(page)) {
    throw new ClinicalError('invalid_query', 'page inválida');
  }
  if (!isPositiveInt32(page_size) || page_size > 50) {
    throw new ClinicalError('invalid_query', 'page_size inválida');
  }
  return { page, page_size };
}

export function assertGenerateCargoRole(roles: readonly string[], origen: CargoOrigen): void {
  if (origen === 'manual') {
    if (!roles.includes('caja')) {
      throw new ClinicalError('forbidden', 'Solo caja puede generar cargos manuales');
    }
    return;
  }
  const internal = roles.some((r) =>
    ['medico', 'enfermeria', 'odontologo', 'sistema', 'caja'].includes(r),
  );
  if (!internal) {
    throw new ClinicalError('forbidden', 'Origen no autorizado para este actor');
  }
}

export function assertListPendingRole(roles: readonly string[]): void {
  if (!roles.some((r) => r === 'caja' || r === 'recepcion')) {
    throw new ClinicalError('forbidden', 'Rol no autorizado para cargos pendientes');
  }
}

export function buildCargoFromTariff(args: {
  id_cargo: number;
  id_expediente: number;
  input: CargoInput;
  servicio: SERVICIO_FACTURABLE;
  now: string;
}): CARGO {
  const { id_cargo, id_expediente, input, servicio, now } = args;
  if (!servicio.vigente) {
    throw new ClinicalError('conflict', 'Servicio no vigente');
  }
  if (Number(servicio.precio_unitario) <= 0) {
    throw new ClinicalError('conflict', 'Precio de tarifa inválido');
  }
  const precio_unitario = Number(servicio.precio_unitario).toFixed(2);
  const cantidad = Number(input.cantidad);
  const subtotal = multiplyMoney(input.cantidad, precio_unitario);
  return {
    id_cargo,
    id_expediente,
    codigo_servicio: servicio.codigo_servicio,
    origen: input.origen,
    id_consulta: input.id_consulta ?? null,
    id_procedimiento: input.id_procedimiento ?? null,
    id_admision: input.id_admision ?? null,
    id_consumo: input.id_consumo ?? null,
    id_participacion: input.id_participacion ?? null,
    descripcion: servicio.nombre.slice(0, 150),
    cantidad,
    precio_unitario,
    subtotal,
    fecha_hora: now,
    estado: 'pendiente',
  };
}

export function toCargoCaja(cargo: CARGO): CargoCaja {
  return {
    id_cargo: cargo.id_cargo,
    descripcion: cargo.descripcion,
    cantidad: Number(cargo.cantidad).toFixed(2),
    precio_unitario: cargo.precio_unitario,
    subtotal: cargo.subtotal,
    estado: cargo.estado,
  };
}
