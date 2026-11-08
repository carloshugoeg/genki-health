/** Port declarations for module `record` (F1). Type-only; no implementations. */

import type { ArchiveRequest, ExpedienteDto } from '@genki/shared';
import type { FichaCompleta } from '@genki/shared/full/patient';
import type {
  ALERGIA,
  ALERGIAInput,
  ANTECEDENTE,
  ANTECEDENTEInput,
} from '@genki/shared/full/record';
import type { OperationContext } from './context.js';

export type Op12Request = {
  params: { id: number };
  query: Record<string, never>;
  body: Record<string, never>;
};
export type Op12Response = FichaCompleta;

export type Op15Request = {
  params: { id: number };
  query: Record<string, never>;
  body: ANTECEDENTEInput;
};
export type Op15Response = ANTECEDENTE;

export type Op16Request = {
  params: { id: number };
  query: Record<string, never>;
  body: ALERGIAInput;
};
export type Op16Response = ALERGIA;

export type Op18Request = {
  params: { id: number };
  query: Record<string, never>;
  body: ArchiveRequest;
};
export type Op18Response = ExpedienteDto;

export type Op19Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { motivo: string };
};
export type Op19Response = ExpedienteDto;

export interface RecordRepositoryPort {
  op12(input: Op12Request, context: OperationContext): Promise<Op12Response>;
  op15(input: Op15Request, context: OperationContext): Promise<Op15Response>;
  op16(input: Op16Request, context: OperationContext): Promise<Op16Response>;
  op18(input: Op18Request, context: OperationContext): Promise<Op18Response>;
  op19(input: Op19Request, context: OperationContext): Promise<Op19Response>;
}
