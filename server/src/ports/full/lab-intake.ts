/** Port declarations for module `lab-intake` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  ORDEN_EXAMEN,
  MUESTRA,
  MUESTRAInput,
  LabOrderInput,
} from '@genki/shared/full/lab-intake';

export type Op48Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: LabOrderInput;
};
export type Op48Response = ORDEN_EXAMEN;

export type Op49Request = {
  params: { id: number };
  query: Record<string, never>;
  body: MUESTRAInput;
};
export type Op49Response = MUESTRA;

export interface LabIntakeRepositoryPort {
  op48(input: Op48Request, context: OperationContext): Promise<Op48Response>;
  op49(input: Op49Request, context: OperationContext): Promise<Op49Response>;
}
