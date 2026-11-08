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
  DiagnosticoInput,
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
