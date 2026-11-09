import { createHash } from 'node:crypto';
import type { Page, PageQuery } from '@genki/shared/full/charges';
import type { EconomicStore, EconomicTransaction } from '../../ports/full/charges.js';
import type { OperationContext } from '../../ports/full/context.js';

export class EconomicError extends Error {
  constructor(
    public readonly code:
      'conflict' | 'not_found' | 'reference_not_found' | 'forbidden' | 'invalid_query',
    message: string,
  ) {
    super(message);
  }
}
export function ensure(
  value: unknown,
  message: string,
  code: EconomicError['code'] = 'conflict',
): asserts value {
  if (!value) throw new EconomicError(code, message);
}
/** All amounts are integer centavos internally, never floating-point sums. */
export function cents(value: string): number {
  ensure(typeof value === 'string' && /^\d{1,10}(\.\d{1,2})?$/.test(value), 'Importe inválido');
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function money(value: number): string {
  ensure(Number.isSafeInteger(value) && value >= 0, 'Importe fuera de rango');
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
}
export function roundRatio(value: number, multiplier: number, divisor: number): number {
  const product = BigInt(value) * BigInt(multiplier);
  return Number((product + BigInt(divisor / 2)) / BigInt(divisor));
}
export function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function text(value: unknown): asserts value is string {
  ensure(
    typeof value === 'string' && value.trim().length > 0 && value.length <= 500,
    'Texto requerido',
  );
}
export function positiveId(value: unknown): asserts value is number {
  ensure(Number.isSafeInteger(value) && Number(value) > 0, 'Identificador inválido');
}
export function date(value: string): void {
  ensure(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    'Fecha inválida',
    'invalid_query',
  );
}
export function timestamp(value: string): void {
  ensure(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'Fecha/hora inválida');
}
export function page<T>(items: T[], query: PageQuery): Page<T> {
  const p = query.page ?? 1,
    size = query.page_size ?? 20;
  ensure(
    Number.isInteger(p) && p > 0 && Number.isInteger(size) && size > 0 && size <= 50,
    'Paginación inválida',
    'invalid_query',
  );
  return {
    items: items.slice((p - 1) * size, p * size),
    page: p,
    page_size: size,
    total: items.length,
  };
}
export async function next(tx: EconomicTransaction, key: string): Promise<number> {
  const value = ((await tx.get<number>('counters', key)) ?? 0) + 1;
  positiveId(value);
  await tx.put('counters', key, value);
  return value;
}
export function scoped<T>(
  store: EconomicStore,
  ctx: OperationContext,
  work: (tx: EconomicTransaction) => Promise<T>,
): Promise<T> {
  ensure(store.institution === ctx.id_institucion, 'Institución ajena', 'forbidden');
  positiveId(ctx.id_usuario);
  timestamp(ctx.now);
  return store.transaction(work);
}
export async function patient(tx: EconomicTransaction, id: number) {
  positiveId(id);
  const found = await tx.patient(id);
  ensure(found, 'Paciente no encontrado', 'not_found');
  return found;
}
export async function idempotent<T>(
  tx: EconomicTransaction,
  key: string,
  input: unknown,
  work: () => Promise<T>,
): Promise<T> {
  text(key);
  key = hash(key);
  const digest = hash(input);
  const existing = await tx.get<{ digest: string; result: T }>('commands', key);
  if (existing) {
    ensure(existing.digest === digest, 'Clave reutilizada con otra operación');
    return existing.result;
  }
  const result = await work();
  await tx.put('commands', key, { digest, result });
  return result;
}
