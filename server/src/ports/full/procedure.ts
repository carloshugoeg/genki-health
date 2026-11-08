/** Port declarations for module `procedure` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { ProcedimientoBundle, PROCEDIMIENTO } from '@genki/shared/full/procedure';
import type { NOTA_EVOLUCION, NOTA_EVOLUCIONInput } from '@genki/shared/full/schema';

export type Op36Request = {
  params: { id: number };
  query: Record<string, never>;
  body: NOTA_EVOLUCIONInput;
};
export type Op36Response = NOTA_EVOLUCION;

export type Op37Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: ProcedimientoBundle;
};
export type Op37Response = PROCEDIMIENTO;

export interface ProcedureRepositoryPort {
  op36(input: Op36Request, context: OperationContext): Promise<Op36Response>;
  op37(input: Op37Request, context: OperationContext): Promise<Op37Response>;
}
