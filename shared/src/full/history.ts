/** Full-system DTOs for module `history` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

import type { Page } from './schema.js';

export type HistoryEvent = {
  tipo:
    | 'consulta'
    | 'documento'
    | 'admision'
    | 'nota'
    | 'procedimiento'
    | 'perinatal'
    | 'medicion'
    | 'vacuna'
    | 'hito'
    | 'examen'
    | 'odontograma'
    | 'plan'
    | 'sesion';
  id: number;
  fecha_hora: string;
  datos: Record<string, unknown>;
};
export type HistoryPage = Page<HistoryEvent>;
