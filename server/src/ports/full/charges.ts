/** Port declarations for module `charges` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  SERVICIO_FACTURABLE,
  CARGO,
  CargoInput,
  CargoCaja,
  Page,
  PageQuery,
} from '@genki/shared/full/charges';

export type Op68Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: CargoInput;
};
export type Op68Response = CARGO;

export type Op69Request = {
  params: { id: number };
  query: PageQuery;
  body: Record<string, never>;
};
export type Op69Response = Page<CargoCaja>;

export type Op70Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { estado: 'anulado' | 'cortesia'; motivo: string };
};
export type Op70Response = CargoCaja;

export type Op71Request = {
  params: Record<string, never>;
  query: PageQuery;
  body: Record<string, never>;
};
export type Op71Response = Page<SERVICIO_FACTURABLE>;

export interface ChargesRepositoryPort {
  op68(input: Op68Request, context: OperationContext): Promise<Op68Response>;
  op69(input: Op69Request, context: OperationContext): Promise<Op69Response>;
  op70(input: Op70Request, context: OperationContext): Promise<Op70Response>;
  op71(input: Op71Request, context: OperationContext): Promise<Op71Response>;
}

/** Native transaction boundary shared by the six economic modules. */
export const ECONOMIC_TABLES = [
  'charges',
  'services',
  'charge_events',
  'audit',
  'counters',
  'professionals',
  'contracts',
  'personnel_types',
  'tariffs',
  'supplies',
  'consumptions',
  'metadata',
  'participations',
  'roles',
  'honoraria_snapshots',
  'invoices',
  'invoice_lines',
  'payments',
  'commands',
] as const;
export type EconomicTable = (typeof ECONOMIC_TABLES)[number];
export interface PatientReference {
  id_paciente: number;
  id_expediente: number;
}
export interface ActReference {
  id: number;
  kind: 'consulta' | 'procedimiento';
  id_paciente: number;
  codigo_servicio: string;
  fecha_hora: string;
}
/** Supplied by clinical wiring; must read native institution-scoped references in this UoW. */
export interface EconomicReferences {
  patient(id: number): Promise<PatientReference | null>;
  act(kind: ActReference['kind'], id: number): Promise<ActReference | null>;
}
export interface EconomicTransaction extends EconomicReferences {
  get<T>(table: EconomicTable, key: string | number): Promise<T | null>;
  list<T>(table: EconomicTable): Promise<T[]>;
  put<T>(table: EconomicTable, key: string | number, value: T): Promise<void>;
}
export interface EconomicStore {
  readonly institution: number;
  transaction<T>(work: (tx: EconomicTransaction) => Promise<T>): Promise<T>;
}
