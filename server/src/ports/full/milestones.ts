/** Port declarations for module `milestones` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { SEGUIMIENTO_HITO, SEGUIMIENTO_HITOInput } from '@genki/shared/full/milestones';

export type Op46Request = {
  params: { id: number; hito: number };
  query: Record<string, never>;
  body: SEGUIMIENTO_HITOInput;
};
export type Op46Response = SEGUIMIENTO_HITO;

export interface MilestonesRepositoryPort {
  op46(input: Op46Request, context: OperationContext): Promise<Op46Response>;
}
