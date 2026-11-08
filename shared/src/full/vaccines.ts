/** Full-system DTOs for module `vaccines` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { VACUNA, DOSIS_VACUNA, VACUNA_INTERVALO } from './schema.js';

import type { DOSIS_VACUNA, Page } from './schema.js';

export type DosisSchedule = DOSIS_VACUNA & { atrasada: boolean; version_esquema: string };
export type DosisPendiente = DosisSchedule & {
  id_paciente: number;
  nombre: string;
  telefono: string | null;
};
export type DosisPendientePage = Page<DosisPendiente>;
