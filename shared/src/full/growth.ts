/** Full-system DTOs for module `growth` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type {
  ANTECEDENTE_PERINATAL,
  ANTECEDENTE_PERINATALInput,
  MEDICION_ANTROPOMETRICA,
  REFERENCIA_OMS,
} from './schema.js';

export type MedicionInput = {
  fecha_medicion: string;
  peso_kg: number;
  talla_cm: number;
  perimetro_cefalico_cm?: number;
};
