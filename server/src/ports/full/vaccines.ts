/** Port declarations for module `vaccines` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  DOSIS_VACUNA,
  DosisSchedule,
  DosisPendiente,
  Page,
  PageQuery,
} from '@genki/shared/full/vaccines';

export type Op43Request = {
  params: { id: number };
  query: Record<string, never>;
  body: Record<string, never>;
};
export type Op43Response = DosisSchedule[];

export type Op44Request = {
  params: { id: number };
  query: Record<string, never>;
  body: {
    fecha_aplicacion: string;
    lote: string;
    fabricante?: string;
    sitio_aplicacion?: string;
    id_profesional: number;
  };
};
export type Op44Response = DOSIS_VACUNA;

export type Op45Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { reaccion_adversa: string };
};
export type Op45Response = DOSIS_VACUNA;

export type Op47Request = {
  params: Record<string, never>;
  query: PageQuery & { hasta: string };
  body: Record<string, never>;
};
export type Op47Response = Page<DosisPendiente>;

export interface VaccinesRepositoryPort {
  op43(input: Op43Request, context: OperationContext): Promise<Op43Response>;
  op44(input: Op44Request, context: OperationContext): Promise<Op44Response>;
  op45(input: Op45Request, context: OperationContext): Promise<Op45Response>;
  op47(input: Op47Request, context: OperationContext): Promise<Op47Response>;
}
