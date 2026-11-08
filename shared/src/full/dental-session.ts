/** Full-system DTOs for module `dental-session` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { SESION_TRATAMIENTO } from './schema.js';

export type SesionInput = {
  id_cita?: number;
  fecha: string;
  lineas: number[];
  anestesia_utilizada?: string;
  observaciones?: string;
  expected_revision: number;
};
export type DentalBalance = {
  presupuesto: string;
  ejecutado: string;
  facturado: string;
  pagado: string;
  pendiente: string;
};
