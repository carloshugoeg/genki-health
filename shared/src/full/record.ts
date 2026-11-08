/** Full-system DTOs for module `record` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { ANTECEDENTE, ANTECEDENTEInput, ALERGIA, ALERGIAInput } from './schema.js';

export const ANTECEDENTE_TIPOS = ['personal', 'familiar', 'quirurgico', 'habito'] as const;
export type AntecedenteTipo = (typeof ANTECEDENTE_TIPOS)[number];

export const ALERGIA_TIPOS = ['medicamento', 'alimento', 'ambiental', 'otro'] as const;
export const ALERGIA_SEVERIDADES = ['leve', 'moderada', 'severa'] as const;

export const RECORD_CLINICAL_ROLES = ['medico', 'odontologo', 'enfermeria'] as const;
