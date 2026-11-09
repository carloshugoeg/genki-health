/** Port declarations for module `consultation` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  CloseConsultaRequest,
  ConsultaCompleta,
  ConsultaDto,
  DiagnosticoInput,
  ExpedienteEstado,
  TratamientoInput,
} from '@genki/shared';
import type { ClinicalItemEntity, ItemPatch } from '../../domain/full/clinical-maintenance.js';
import type { CloseConsultaBundle } from '../consulta-repository.js';
import type {
  SIGNOS_VITALES,
  SIGNOS_VITALESInput,
  OpenConsultaInput,
  ConsultaDraft,
  ClinicalItemDto,
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

/** Read model used to close an open consultation inside the caller's unit of work. */
export interface ConsultaParaCierre {
  consulta: ConsultaDto;
  expediente_estado: ExpedienteEstado;
}

/** Children and annotations persisted when an open consultation becomes `cerrada` (OP-31). */
export interface CierreConsultaBundle {
  fecha_hora_fin: string;
  enfermedad_actual: string | null;
  exploracion_fisica: string | null;
  plan: string | null;
  diagnosticos: CloseConsultaBundle['diagnosticos'];
  tratamientos: CloseConsultaBundle['tratamientos'];
  receta?: CloseConsultaBundle['receta'];
}

/** Current state of a diagnosis / treatment / prescription plus its consultation context. */
export interface ClinicalItemSnapshot {
  item: ClinicalItemDto;
  id_consulta: number;
  consulta_estado: string;
  expediente_estado: ExpedienteEstado;
}

/** Status/annotation columns only; identity, links and dates of record never change. */
export type ClinicalItemPatch = { id: number } & ItemPatch;

/** BITACORA row (Entrega I): written in the same transaction as the clinical change. */
export interface BitacoraClinicaEntry {
  id_usuario: number;
  entidad: 'consulta' | ClinicalItemEntity;
  id_registro: string;
  accion: 'modificacion';
  fecha_hora: string;
  detalle: {
    op: number;
    resultado: 'ok';
    operacion: 'cierre' | 'modificacion' | 'anulacion';
    campos: string[];
    motivo: string | null;
    id_consulta: number;
    antes: Record<string, string | null>;
    despues: Record<string, string | null>;
  };
}

export interface ConsultationRepositoryPort {
  op26(input: Op26Request, context: OperationContext): Promise<Op26Response>;
  op27(input: Op27Request, context: OperationContext): Promise<Op27Response>;
  op28(input: Op28Request, context: OperationContext): Promise<Op28Response>;
  op29(input: Op29Request, context: OperationContext): Promise<Op29Response>;
  op30(input: Op30Request, context: OperationContext): Promise<Op30Response>;
  op31(input: Op31Request, context: OperationContext): Promise<Op31Response>;
  op32(input: Op32Request, context: OperationContext): Promise<Op32Response>;
  op33(input: Op33Request, context: OperationContext): Promise<Op33Response>;

  /*
   * Clinical maintenance (OP-31 close + corrections). Each method runs inside the caller's
   * `unitOfWork.runInTransaction`, is scoped to the adapter's institution (null otherwise) and
   * locks/reads what it returns so archive and correction serialize on the expediente.
   */
  findConsultaParaCierre(id_consulta: number): Promise<ConsultaParaCierre | null>;
  guardarCierreConsulta(
    id_consulta: number,
    bundle: CierreConsultaBundle,
  ): Promise<ConsultaCompleta>;
  findClinicalItem(entidad: ClinicalItemEntity, id: number): Promise<ClinicalItemSnapshot | null>;
  updateClinicalItem(patch: ClinicalItemPatch): Promise<ClinicalItemDto>;
  appendBitacora(entry: BitacoraClinicaEntry): Promise<void>;
}
