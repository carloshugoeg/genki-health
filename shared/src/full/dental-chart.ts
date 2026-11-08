/** Full-system DTOs for module `dental-chart` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { ODONTOGRAMA, PIEZA_DENTAL } from './schema.js';

export type PiezaPatch = {
  estado: 'sana' | 'caries' | 'obturada' | 'ausente' | 'corona' | 'implante' | 'endodoncia';
  superficies: Partial<
    Record<
      'mesial' | 'distal' | 'vestibular' | 'lingual' | 'oclusal',
      'sana' | 'caries' | 'obturada' | 'corona' | 'endodoncia'
    >
  >;
  movilidad: 0 | 1 | 2 | 3;
  observacion?: string;
  expected_revision: number;
};
