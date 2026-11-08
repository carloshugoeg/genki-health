/** Port declarations for module `dental-chart` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { ODONTOGRAMA, PIEZA_DENTAL, PiezaPatch } from '@genki/shared/full/dental-chart';

export type Op55Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { id_profesional: number; observacion_general?: string };
};
export type Op55Response = ODONTOGRAMA;

export type Op56Request = {
  params: { id: number; numero: number };
  query: Record<string, never>;
  body: PiezaPatch;
};
export type Op56Response = PIEZA_DENTAL;

export interface DentalChartRepositoryPort {
  op55(input: Op55Request, context: OperationContext): Promise<Op55Response>;
  op56(input: Op56Request, context: OperationContext): Promise<Op56Response>;
}
