/** Full-system DTOs for module `patient` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { CONTACTO_EMERGENCIA, CONTACTO_EMERGENCIAInput } from './schema.js';

import type { ExpedienteDto, PacienteDto, RegisterPacienteRequest } from '@genki/shared';
import type { ALERGIA, ANTECEDENTE } from './schema.js';
import type { CONTACTO_EMERGENCIA } from './schema.js';

export type PacientePatch = Partial<Omit<RegisterPacienteRequest, 'responsables'>>;
export type FichaCompleta = {
  paciente: PacienteDto;
  expediente: ExpedienteDto;
  alergias: ALERGIA[];
  antecedentes: ANTECEDENTE[];
  contactos: CONTACTO_EMERGENCIA[];
};
