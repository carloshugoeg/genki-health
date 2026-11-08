/** Port declarations for module `dental-plan` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { PLAN_TRATAMIENTO, PlanInput } from '@genki/shared/full/dental-plan';

export type Op57Request = {
  params: { id: number };
  query: Record<string, never>;
  body: PlanInput;
};
export type Op57Response = PLAN_TRATAMIENTO;

export type Op58Request = {
  params: { id: number };
  query: Record<string, never>;
  body: Record<string, never>;
};
export type Op58Response = PLAN_TRATAMIENTO;

export interface DentalPlanRepositoryPort {
  op57(input: Op57Request, context: OperationContext): Promise<Op57Response>;
  op58(input: Op58Request, context: OperationContext): Promise<Op58Response>;
}
