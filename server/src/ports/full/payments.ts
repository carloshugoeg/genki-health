/** Port declarations for module `payments` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  FacturaCompleta,
  PagoInput,
  EstadoCuenta,
  CierreCaja,
  PageQuery,
} from '@genki/shared/full/payments';

export type Op74Request = {
  params: { id: number };
  query: Record<string, never>;
  body: PagoInput;
};
export type Op74Response = FacturaCompleta;

export type Op75Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { motivo: string };
};
export type Op75Response = FacturaCompleta;

export type Op76Request = {
  params: { id: number };
  query: PageQuery;
  body: Record<string, never>;
};
export type Op76Response = EstadoCuenta;

export type Op77Request = {
  params: Record<string, never>;
  query: { fecha: string };
  body: Record<string, never>;
};
export type Op77Response = CierreCaja;

export interface PaymentsRepositoryPort {
  op74(input: Op74Request, context: OperationContext): Promise<Op74Response>;
  op75(input: Op75Request, context: OperationContext): Promise<Op75Response>;
  op76(input: Op76Request, context: OperationContext): Promise<Op76Response>;
  op77(input: Op77Request, context: OperationContext): Promise<Op77Response>;
}
