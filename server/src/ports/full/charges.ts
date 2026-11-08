/** Port declarations for module `charges` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  SERVICIO_FACTURABLE,
  CARGO,
  CargoInput,
  CargoCaja,
  DisposicionInput,
  Page,
  PageQuery,
} from '@genki/shared/full/charges';

export type Op68Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: CargoInput;
};
export type Op68Response = CARGO;

export type Op69Request = {
  params: { id: number };
  query: PageQuery;
  body: Record<string, never>;
};
export type Op69Response = Page<CargoCaja>;

export type Op70Request = {
  params: { id: number };
  query: Record<string, never>;
  body: DisposicionInput;
};
export type Op70Response = CargoCaja;

export type Op71Request = {
  params: Record<string, never>;
  query: PageQuery;
  body: Record<string, never>;
};
export type Op71Response = Page<SERVICIO_FACTURABLE>;

export interface ChargesRepositoryPort {
  op68(input: Op68Request, context: OperationContext): Promise<Op68Response>;
  op69(input: Op69Request, context: OperationContext): Promise<Op69Response>;
  op70(input: Op70Request, context: OperationContext): Promise<Op70Response>;
  op71(input: Op71Request, context: OperationContext): Promise<Op71Response>;
}
