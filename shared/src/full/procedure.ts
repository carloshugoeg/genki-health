/** Full-system DTOs for module `procedure` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { CATALOGO_PROCEDIMIENTO, PROCEDIMIENTO } from './schema.js';

import type { CONSUMO_INSUMOInput, PARTICIPACIONInput } from './schema.js';

export type ActRef = { id_consulta?: number; id_procedimiento?: number };
export type ProcedimientoBundle = {
  id_admision?: number;
  id_consulta?: number;
  codigo_procedimiento: string;
  id_profesional: number;
  fecha_hora: string;
  sala?: string;
  hallazgos?: string;
  complicaciones?: string;
  equipo: PARTICIPACIONInput[];
  consumos: CONSUMO_INSUMOInput[];
};
