/** Full-system DTOs for module `record` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { ANTECEDENTE, ANTECEDENTEInput, ALERGIA, ALERGIAInput } from './schema.js';

export const ANTECEDENTE_TIPOS = ['personal', 'familiar', 'quirurgico', 'habito'] as const;
export type AntecedenteTipo = (typeof ANTECEDENTE_TIPOS)[number];

export const ALERGIA_TIPOS = ['medicamento', 'alimento', 'ambiental', 'otro'] as const;
export type AlergiaTipo = (typeof ALERGIA_TIPOS)[number];

export const ALERGIA_SEVERIDADES = ['leve', 'moderada', 'severa'] as const;
export type AlergiaSeveridad = (typeof ALERGIA_SEVERIDADES)[number];

export const RECORD_CLINICAL_ROLES = ['medico', 'odontologo', 'enfermeria'] as const;

export const RECORD_ARCHIVE_ROLES = ['administrador', 'recepcion'] as const;

export const RECORD_REACTIVATE_ROLES = ['administrador'] as const;

export const ARCHIVE_MOTIVOS = [
  'traslado',
  'fallecimiento',
  'administrativo',
  'inactividad',
] as const;
export type ArchiveMotivo = (typeof ARCHIVE_MOTIVOS)[number];
