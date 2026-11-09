/** Port declarations for module `dental-session` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  SESION_TRATAMIENTO,
  SesionInput,
  DentalBalance,
} from '@genki/shared/full/dental-session';

export type Op59Request = {
  params: { id: number };
  query: Record<string, never>;
  body: SesionInput;
};
export type Op59Response = SESION_TRATAMIENTO;

export type Op60Request = {
  params: { id: number };
  query: Record<string, never>;
  body: Record<string, never>;
};
export type Op60Response = DentalBalance;

export interface DentalSessionRepositoryPort {
  op59(input: Op59Request, context: OperationContext): Promise<Op59Response>;
  op60(input: Op60Request, context: OperationContext): Promise<Op60Response>;
}
