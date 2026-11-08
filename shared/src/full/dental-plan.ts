/** Full-system DTOs for module `dental-plan` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { PROCEDIMIENTO_DENTAL, PLAN_TRATAMIENTO } from './schema.js';

export type PlanInput = {
  id_profesional: number;
  detalle: {
    linea: number;
    numero_pieza: number;
    codigo_procedimiento: string;
    orden: number;
    precio_unitario: string;
  }[];
};
