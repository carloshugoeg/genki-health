/** Port declarations for module `agenda` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { CITA, CITAInput, Slot } from '@genki/shared/full/agenda';

export type Op20Request = {
  params: Record<string, never>;
  query: { id_profesional: number; desde: string; hasta: string };
  body: Record<string, never>;
};
export type Op20Response = Slot[];

export type Op21Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: CITAInput;
};
export type Op21Response = CITA;

export type Op22Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { fecha_hora: string; duracion_minutos: number };
};
export type Op22Response = CITA;

export type Op23Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { motivo: string };
};
export type Op23Response = CITA;

export type Op24Request = {
  params: { id: number };
  query: Record<string, never>;
  body: Record<string, never>;
};
export type Op24Response = CITA;

export type Op25Request = {
  params: Record<string, never>;
  query: { fecha: string; id_profesional?: number };
  body: Record<string, never>;
};
export type Op25Response = CITA[];

export interface AgendaRepositoryPort {
  op20(input: Op20Request, context: OperationContext): Promise<Op20Response>;
  op21(input: Op21Request, context: OperationContext): Promise<Op21Response>;
  op22(input: Op22Request, context: OperationContext): Promise<Op22Response>;
  op23(input: Op23Request, context: OperationContext): Promise<Op23Response>;
  op24(input: Op24Request, context: OperationContext): Promise<Op24Response>;
  op25(input: Op25Request, context: OperationContext): Promise<Op25Response>;
}

/** Native storage seam. All callback reads/writes share one native transaction. */
export interface AgendaTransaction {
  list(): Promise<CITA[]>;
  nextId(): Promise<number>;
  put(cita: CITA): Promise<void>;
}
export interface AgendaStore {
  list(institution: number): Promise<CITA[]>;
  /** Sorted lock keys include institution/professional/Guatemala day. */
  transaction<T>(
    institution: number,
    keys: readonly string[],
    work: (tx: AgendaTransaction) => Promise<T>,
  ): Promise<T>;
}
