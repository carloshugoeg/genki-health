/** Port declarations for module `discharge` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { ADMISION } from '@genki/shared/full/schema';

export type Op38Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { id_diagnostico_egreso: number; condicion_egreso: string; fecha_hora_egreso: string };
};
export type Op38Response = ADMISION;

export interface DischargeRepositoryPort {
  op38(input: Op38Request, context: OperationContext): Promise<Op38Response>;
}
