/** Port declarations for module `consultation` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  CloseConsultaRequest,
  ConsultaCompleta,
  ConsultaDto,
  DiagnosticoInput,
  TratamientoInput,
} from '@genki/shared';
import type {
  SIGNOS_VITALES,
  SIGNOS_VITALESInput,
  OpenConsultaInput,
  ConsultaDraft,
  Page,
  PageQuery,
} from '@genki/shared/full/consultation';

export type Op26Request = {
  params: { id: number };
  query: Record<string, never>;
  body: OpenConsultaInput;
};
export type Op26Response = ConsultaDraft;

export type Op27Request = {
  params: { id: number };
  query: Record<string, never>;
  body: SIGNOS_VITALESInput;
};
export type Op27Response = SIGNOS_VITALES;

export type Op28Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { diagnosticos: DiagnosticoInput[]; expected_revision: number };
};
export type Op28Response = ConsultaDraft;

export type Op29Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { tratamientos: TratamientoInput[]; expected_revision: number };
};
export type Op29Response = ConsultaDraft;

export type Op30Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { receta: CloseConsultaRequest['receta']; expected_revision: number };
};
export type Op30Response = ConsultaDraft;

export type Op31Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { expected_revision: number };
};
export type Op31Response = ConsultaCompleta;

export type Op32Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { motivo: string };
};
export type Op32Response = ConsultaDto;

export type Op33Request = {
  params: { id: number };
  query: PageQuery;
  body: Record<string, never>;
};
export type Op33Response = Page<ConsultaCompleta>;

export interface ConsultationRepositoryPort {
  op26(input: Op26Request, context: OperationContext): Promise<Op26Response>;
  op27(input: Op27Request, context: OperationContext): Promise<Op27Response>;
  op28(input: Op28Request, context: OperationContext): Promise<Op28Response>;
  op29(input: Op29Request, context: OperationContext): Promise<Op29Response>;
  op30(input: Op30Request, context: OperationContext): Promise<Op30Response>;
  op31(input: Op31Request, context: OperationContext): Promise<Op31Response>;
  op32(input: Op32Request, context: OperationContext): Promise<Op32Response>;
  op33(input: Op33Request, context: OperationContext): Promise<Op33Response>;
}
