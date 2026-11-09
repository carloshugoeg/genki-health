/** Port declarations for module `lab-results` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  RESULTADO,
  ResultadoInput,
  ResultadoFlags,
  LabHistory,
  Page,
  PageQuery,
} from '@genki/shared/full/lab-results';
import type { ORDEN_EXAMEN } from '@genki/shared/full/schema';

export type Op50Request = {
  params: { id: number };
  query: Record<string, never>;
  body: ResultadoInput;
};
export type Op50Response = RESULTADO;

export type Op51Request = {
  params: { id: number };
  query: Record<string, never>;
  body: Record<string, never>;
};
export type Op51Response = RESULTADO;

export type Op52Request = {
  params: { id: number };
  query: Record<string, never>;
  body: Record<string, never>;
};
export type Op52Response = ResultadoFlags;

export type Op53Request = {
  params: { id: number };
  query: Record<string, never>;
  body: Record<string, never>;
};
export type Op53Response = ORDEN_EXAMEN;

export type Op54Request = {
  params: { id: number };
  query: PageQuery;
  body: Record<string, never>;
};
export type Op54Response = Page<LabHistory>;

export interface LabResultsRepositoryPort {
  op50(input: Op50Request, context: OperationContext): Promise<Op50Response>;
  op51(input: Op51Request, context: OperationContext): Promise<Op51Response>;
  op52(input: Op52Request, context: OperationContext): Promise<Op52Response>;
  op53(input: Op53Request, context: OperationContext): Promise<Op53Response>;
  op54(input: Op54Request, context: OperationContext): Promise<Op54Response>;
}
