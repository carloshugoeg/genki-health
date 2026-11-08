/** Full-system DTOs for module `honoraria` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { ROL_CLINICO, PARTICIPACION, PARTICIPACIONInput } from './schema.js';

export type Liquidacion = {
  id_profesional: number;
  periodo: string;
  actos: { id_participacion: number; codigo_rol: string; honorario: string }[];
  total: string;
};
