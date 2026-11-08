/** Full-system DTOs for module `lab-results` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { RESULTADO, VALOR_REFERENCIA } from './schema.js';

import type { JsonValue, MUESTRA, ORDEN_EXAMEN, Page, RESULTADO } from './schema.js';

export type ResultadoDatos = JsonValue;
export type ResultadoInput = {
  codigo_examen: string;
  id_muestra: number;
  datos: ResultadoDatos;
  observaciones?: string;
};
export type ResultadoFlags = {
  id_resultado: number;
  analitos: {
    nombre: string;
    valor: number;
    unidad: string;
    min: number;
    max: number;
    fuera_rango: boolean;
    referencia_version: string;
  }[];
};
export type LabHistory = { orden: ORDEN_EXAMEN; muestras: MUESTRA[]; resultados: RESULTADO[] };
export type LabHistoryPage = Page<LabHistory>;
