/** Port declarations for module `admission` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { ADMISION, ADMISIONInput, CAMA } from '@genki/shared/full/admission';

export type Op34Request = {
  params: Record<string, never>;
  query: { id_servicio?: number };
  body: Record<string, never>;
};
export type Op34Response = CAMA[];

export type Op35Request = {
  params: { id: number };
  query: Record<string, never>;
  body: ADMISIONInput;
};
export type Op35Response = ADMISION;

export interface AdmissionRepositoryPort {
  op34(input: Op34Request, context: OperationContext): Promise<Op34Response>;
  op35(input: Op35Request, context: OperationContext): Promise<Op35Response>;
}
