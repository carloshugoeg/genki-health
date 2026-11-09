/** Full-system DTOs for module `personnel` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { PROFESIONAL_CONTRATO, TIPO_PERSONAL, TARIFA_HONORARIO } from './schema.js';

import type { PROFESIONAL, PROFESIONAL_CONTRATO } from './schema.js';

export type PersonalInput = {
  action: 'create' | 'update' | 'deactivate';
  id_profesional?: number;
  nombres?: string;
  apellidos?: string;
  id_especialidad?: number | null;
  numero_colegiado?: string | null;
  telefono?: string | null;
  correo?: string | null;
  id_tipo_personal?: number;
  modalidad_contrato?: 'planilla' | 'honorarios' | 'externo';
  fecha_ingreso?: string;
};
export type PersonalDto = { profesional: PROFESIONAL; contrato: PROFESIONAL_CONTRATO };

import type { TARIFA_HONORARIOInput as BaseTarifaInput } from './schema.js';
export type TARIFA_HONORARIOInput = BaseTarifaInput & { vigente_hasta?: string | null };
