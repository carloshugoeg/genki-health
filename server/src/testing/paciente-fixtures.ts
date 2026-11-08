import type { InstitutionKind, RegisterPacienteRequest, ResponsableInput } from '@genki/shared';
import { SEED_MUNICIPIO_ID } from './catalog-seeds.js';

export { defaultKind } from './catalog-seeds.js';

export function baseRegisterInput(
  overrides: Partial<RegisterPacienteRequest> &
    Pick<RegisterPacienteRequest, 'numero_documento'> = {
    numero_documento: 'DOC-0001',
  },
): RegisterPacienteRequest {
  return {
    tipo_documento: overrides.tipo_documento ?? 'DPI',
    numero_documento: overrides.numero_documento,
    primer_nombre: overrides.primer_nombre ?? 'Ana',
    segundo_nombre: overrides.segundo_nombre ?? null,
    primer_apellido: overrides.primer_apellido ?? 'Lopez',
    segundo_apellido: overrides.segundo_apellido ?? null,
    fecha_nacimiento: overrides.fecha_nacimiento ?? '1990-01-15',
    sexo: overrides.sexo ?? 'F',
    tipo_sangre: overrides.tipo_sangre ?? null,
    telefono: overrides.telefono ?? null,
    correo: overrides.correo ?? null,
    direccion: overrides.direccion ?? null,
    id_municipio: overrides.id_municipio ?? SEED_MUNICIPIO_ID,
    ...(overrides.responsables !== undefined ? { responsables: overrides.responsables } : {}),
  };
}

export function guardian(
  overrides: Partial<ResponsableInput> &
    Pick<ResponsableInput, 'es_principal' | 'numero_documento'>,
): ResponsableInput {
  return {
    tipo_documento: overrides.tipo_documento ?? 'DPI',
    numero_documento: overrides.numero_documento,
    nombre_completo: overrides.nombre_completo ?? 'Tutor Legal',
    parentesco: overrides.parentesco ?? 'madre',
    telefono: overrides.telefono ?? '5555-0000',
    correo: overrides.correo ?? null,
    direccion: overrides.direccion ?? null,
    es_principal: overrides.es_principal,
  };
}

export function pediatricRegisterInput(
  variant: 'none' | 'one_principal' | 'two_principal' | 'valid_pair',
): RegisterPacienteRequest {
  const base = baseRegisterInput({
    numero_documento: 'PED-0001',
    primer_nombre: 'Nino',
    primer_apellido: 'Garcia',
    fecha_nacimiento: '2018-06-01',
    sexo: 'M',
  });
  if (variant === 'none') {
    return { ...base, responsables: [] };
  }
  if (variant === 'one_principal') {
    return {
      ...base,
      responsables: [guardian({ numero_documento: 'TUT-1', es_principal: true })],
    };
  }
  if (variant === 'two_principal') {
    return {
      ...base,
      responsables: [
        guardian({ numero_documento: 'TUT-1', es_principal: true }),
        guardian({
          numero_documento: 'TUT-2',
          es_principal: true,
          parentesco: 'padre',
          nombre_completo: 'Padre Garcia',
        }),
      ],
    };
  }
  return {
    ...base,
    responsables: [
      guardian({ numero_documento: 'TUT-1', es_principal: true }),
      guardian({
        numero_documento: 'TUT-2',
        es_principal: false,
        parentesco: 'padre',
        nombre_completo: 'Padre Garcia',
      }),
    ],
  };
}

export function threeSearchPatients(): RegisterPacienteRequest[] {
  return [
    baseRegisterInput({
      numero_documento: 'SEARCH-001',
      primer_nombre: 'Maria',
      primer_apellido: 'Quetzal',
    }),
    baseRegisterInput({
      numero_documento: 'SEARCH-002',
      primer_nombre: 'Pedro',
      primer_apellido: 'Quetzal',
    }),
    baseRegisterInput({
      numero_documento: 'SEARCH-003',
      primer_nombre: 'Lucia',
      primer_apellido: 'Bosque',
    }),
  ];
}

export function pediatricKind(): InstitutionKind {
  return 'centro_pediatrico';
}
