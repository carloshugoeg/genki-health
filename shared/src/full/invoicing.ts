/** Full-system DTOs for module `invoicing` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { FACTURA, DETALLE_FACTURA, CORRELATIVO_FACTURA } from './schema.js';

import type { DETALLE_FACTURA, FACTURA, PAGO } from './schema.js';

export type FacturaInput = {
  cargo_ids: number[];
  serie: string;
  nombre_receptor: string;
  nit_receptor: string;
  descuento?: string;
  cobertura_seguro?: string;
  preview_hash: string;
};
export type FacturaCompleta = { factura: FACTURA; lineas: DETALLE_FACTURA[]; pagos: PAGO[] };
