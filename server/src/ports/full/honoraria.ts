/** Port declarations for module `honoraria` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { ActRef } from '@genki/shared/full/procedure';
import type { Liquidacion, PARTICIPACION, PARTICIPACIONInput } from '@genki/shared/full/honoraria';

export type Op63Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: PARTICIPACIONInput;
};
export type Op63Response = PARTICIPACION;

export type Op64Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: ActRef;
};
export type Op64Response = PARTICIPACION[];

export type Op65Request = {
  params: Record<string, never>;
  query: { desde: string; hasta: string; id_profesional?: number };
  body: Record<string, never>;
};
export type Op65Response = Liquidacion[];

export interface HonorariaRepositoryPort {
  op63(input: Op63Request, context: OperationContext): Promise<Op63Response>;
  op64(input: Op64Request, context: OperationContext): Promise<Op64Response>;
  op65(input: Op65Request, context: OperationContext): Promise<Op65Response>;
}
