/** Full-system DTOs for module `lab-intake` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { ORDEN_EXAMEN, ORDEN_EXAMEN_ITEM, EXAMEN, MUESTRA, MUESTRAInput } from './schema.js';

export type LabOrderInput = {
  id_paciente: number;
  institucion_origen: number;
  medico_solicitante: string;
  prioridad: 'rutina' | 'urgente';
  examenes: string[];
  observaciones?: string;
  referencia_externa?: string;
};
