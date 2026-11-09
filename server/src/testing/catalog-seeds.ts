import type { CatalogosDto, InstitutionKind } from '@genki/shared';

export const SEED_MUNICIPIO_ID = 1;
export const SEED_PROFESIONAL_ID = 1;
export const SEED_PROFESIONAL_99_ID = 99;
export const SEED_CIE10 = 'Z00.0';
export const SEED_MEDICAMENTO_1 = 1;
export const SEED_MEDICAMENTO_2 = 2;
export const OTHER_INSTITUTION_ID = 99;

export function expectedPrimaryCatalog(): CatalogosDto {
  return {
    municipios: [{ id_municipio: SEED_MUNICIPIO_ID, nombre: 'Municipio de prueba' }],
    profesionales: [
      {
        id_profesional: SEED_PROFESIONAL_ID,
        nombres: 'Profesional Simulado',
        apellidos: 'Uno',
      },
    ],
    medicamentos: [
      { id_medicamento: SEED_MEDICAMENTO_1, nombre_generico: 'Medicamento didáctico A' },
      { id_medicamento: SEED_MEDICAMENTO_2, nombre_generico: 'Medicamento didáctico B' },
    ],
    cie10: [{ codigo_cie10: SEED_CIE10, descripcion: 'Examen general' }],
  };
}

export function expectedInstitution99Catalog(): CatalogosDto {
  return {
    municipios: [{ id_municipio: SEED_MUNICIPIO_ID, nombre: 'Municipio de prueba' }],
    profesionales: [
      {
        id_profesional: SEED_PROFESIONAL_99_ID,
        nombres: 'Profesional Simulado',
        apellidos: 'Institucion99',
      },
    ],
    medicamentos: [
      { id_medicamento: SEED_MEDICAMENTO_1, nombre_generico: 'Medicamento didáctico A' },
      { id_medicamento: SEED_MEDICAMENTO_2, nombre_generico: 'Medicamento didáctico B' },
    ],
    cie10: [{ codigo_cie10: SEED_CIE10, descripcion: 'Examen general' }],
  };
}

export function defaultKind(): InstitutionKind {
  return 'hospital_general';
}
