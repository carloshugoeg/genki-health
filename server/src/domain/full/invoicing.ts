import { cents, ensure, hash, money, roundRatio } from './charges.js';
import type { CARGO, SERVICIO_FACTURABLE, InvoicePreview } from '@genki/shared/full/charges';
export function totals(
  rows: CARGO[],
  services: SERVICIO_FACTURABLE[],
): Omit<InvoicePreview, 'cargos'> {
  const subtotal = rows.reduce((sum, c) => sum + cents(c.subtotal), 0);
  const taxable = rows.reduce(
    (sum, c) =>
      sum +
      (services.find((s) => s.codigo_servicio === c.codigo_servicio)?.afecto_iva
        ? cents(c.subtotal)
        : 0),
    0,
  );
  const tax = roundRatio(taxable, 12, 100);
  return {
    subtotal: money(subtotal),
    impuesto: money(tax),
    total: money(subtotal + tax),
    preview_hash: hash(
      rows.map((c) => ({
        id: c.id_cargo,
        servicio: c.codigo_servicio,
        descripcion: c.descripcion,
        cantidad: c.cantidad,
        precio: c.precio_unitario,
        subtotal: c.subtotal,
        iva: services.find((s) => s.codigo_servicio === c.codigo_servicio)?.afecto_iva ?? false,
      })),
    ),
  };
}
export function selection(ids: number[]): void {
  ensure(
    Array.isArray(ids) &&
      ids.length > 0 &&
      ids.length <= 100 &&
      new Set(ids).size === ids.length &&
      ids.every((id) => Number.isSafeInteger(id) && id > 0),
    'Selección vacía, duplicada o inválida',
  );
}
