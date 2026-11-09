/** Full-system DTOs for module `consultation` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type {
  SIGNOS_VITALES,
  SIGNOS_VITALESInput,
  CONSULTA_BORRADOR,
  ANULACION_CONSULTA,
} from './schema.js';

import type {
  CloseConsultaRequest,
  ConsultaDto,
  DiagnosticoDto,
  DiagnosticoInput,
  RecetaDto,
  TratamientoDto,
  TratamientoInput,
} from '@genki/shared';

export type OpenConsultaInput = {
  id_profesional: number;
  id_cita?: number | null;
  tipo: 'primera_vez' | 'seguimiento' | 'emergencia';
  motivo_consulta: string;
  fecha_hora_inicio: string;
};

export type FullConsultaDto = Omit<ConsultaDto, 'estado' | 'tipo'> & {
  estado: 'abierta' | 'cerrada' | 'anulada';
  tipo: 'primera_vez' | 'seguimiento' | 'emergencia';
};

export type ConsultaDraft = {
  consulta: FullConsultaDto;
  revision: number;
  diagnosticos: DiagnosticoInput[];
  tratamientos: TratamientoInput[];
  receta: CloseConsultaRequest['receta'] | null;
};

export function isFullConsultaDto(value: unknown): value is FullConsultaDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  const estado = row.estado;
  const tipo = row.tipo;
  return (
    (estado === 'abierta' || estado === 'cerrada' || estado === 'anulada') &&
    (tipo === 'primera_vez' || tipo === 'seguimiento' || tipo === 'emergencia')
  );
}

/**
 * OP-31 "Cerrar consulta" for a consultation opened with OP-26: the same atomic composer as the
 * closed-consultation flow, minus the header fields already stored on the open consultation.
 */
export type CerrarConsultaInput = {
  enfermedad_actual?: string | null;
  exploracion_fisica?: string | null;
  plan?: string | null;
  diagnosticos: DiagnosticoInput[];
  tratamientos: TratamientoInput[];
  receta?: CloseConsultaRequest['receta'];
};

/** Clinical children that can be corrected after the consultation is closed (never deleted). */
export type ClinicalItemEntity = 'diagnostico' | 'tratamiento' | 'receta';
export type AccionMantenimiento = 'modificacion' | 'anulacion';

/** DIAGNOSTICO.tipo domain: presuntivo, definitivo, descartado (anulación = descartado). */
export type DiagnosticoCambios = { tipo?: 'presuntivo' | 'definitivo'; descripcion?: string };
/** TRATAMIENTO.estado domain: activo (vigente), finalizado, suspendido (anulación = suspendido). */
export type TratamientoCambios = {
  estado?: 'activo' | 'finalizado';
  indicaciones?: string | null;
  fecha_fin_estimada?: string | null;
};
/** RECETA.estado domain: emitida, anulada. */
export type RecetaCambios = { observaciones?: string | null };

export type ModificacionClinicaInput =
  | { entidad: 'diagnostico'; motivo: string; cambios: DiagnosticoCambios }
  | { entidad: 'tratamiento'; motivo: string; cambios: TratamientoCambios }
  | { entidad: 'receta'; motivo: string; cambios: RecetaCambios };

export type AnulacionClinicaInput = { entidad: ClinicalItemEntity; motivo: string };

export type ClinicalItemDto =
  | { entidad: 'diagnostico'; item: DiagnosticoDto }
  | { entidad: 'tratamiento'; item: TratamientoDto }
  | { entidad: 'receta'; item: RecetaDto };
