/** Port declarations for module `personnel` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  TARIFA_HONORARIO,
  TARIFA_HONORARIOInput,
  PersonalInput,
  PersonalDto,
} from '@genki/shared/full/personnel';

export type Op61Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: PersonalInput;
};
export type Op61Response = PersonalDto;

export type Op62Request = {
  params: { id: number };
  query: Record<string, never>;
  body: TARIFA_HONORARIOInput;
};
export type Op62Response = TARIFA_HONORARIO;

export interface PersonnelRepositoryPort {
  op61(input: Op61Request, context: OperationContext): Promise<Op61Response>;
  op62(input: Op62Request, context: OperationContext): Promise<Op62Response>;
}
