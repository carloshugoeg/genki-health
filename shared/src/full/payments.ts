export type { FacturaCompleta } from './invoicing.js';
/** Full-system DTOs for module `payments` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { PAGO } from './schema.js';

import type { FacturaCompleta } from './invoicing.js';

export type PagoInput = {
  monto: string;
  metodo: 'efectivo' | 'tarjeta' | 'transferencia' | 'seguro';
  referencia?: string;
};
export type EstadoCuenta = {
  facturas: FacturaCompleta[];
  total: string;
  pagado: string;
  saldo: string;
};
export type CierreCaja = {
  fecha: string;
  por_metodo: { metodo: string; monto: string; anulado: string }[];
  total: string;
};
