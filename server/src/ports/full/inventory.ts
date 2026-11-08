/** Port declarations for module `inventory` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  CONSUMO_INSUMO,
  CONSUMO_INSUMOInput,
  INSUMO,
  Page,
  PageQuery,
} from '@genki/shared/full/inventory';

export type Op66Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: { consumo: CONSUMO_INSUMOInput; id_paciente: number };
};
export type Op66Response = CONSUMO_INSUMO;

export type Op67Request = {
  params: Record<string, never>;
  query: PageQuery & { bajo_stock?: boolean };
  body: Record<string, never>;
};
export type Op67Response = Page<INSUMO>;

export interface InventoryRepositoryPort {
  op66(input: Op66Request, context: OperationContext): Promise<Op66Response>;
  op67(input: Op67Request, context: OperationContext): Promise<Op67Response>;
}
