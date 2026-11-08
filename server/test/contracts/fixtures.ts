import type {
  CatalogosDto,
  CloseConsultaRequest,
  DetalleRecetaDto,
  ExpedienteId,
  InstitutionKind,
  ProfesionalId,
  RegisterPacienteRequest,
  ResponsableInput,
} from '@genki/shared';
import type { CloseConsultaBundle } from '../../src/ports/consulta-repository.js';
import {
  SEED_CIE10,
  SEED_MEDICAMENTO_1,
  SEED_MEDICAMENTO_2,
  SEED_MUNICIPIO_ID,
  SEED_PROFESIONAL_ID,
} from '../../src/testing/catalog-seeds.js';
import type { ContractClinicalContext } from './harness.js';

export {
  defaultKind,
  expectedInstitution99Catalog,
  expectedPrimaryCatalog,
  OTHER_INSTITUTION_ID,
  SEED_CIE10,
  SEED_MEDICAMENTO_1,
  SEED_MEDICAMENTO_2,
  SEED_MUNICIPIO_ID,
  SEED_PROFESIONAL_99_ID,
  SEED_PROFESIONAL_ID,
} from '../../src/testing/catalog-seeds.js';

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

export function closeBodyFromCatalog(
  catalog: CatalogosDto,
  options: {
    withReceta: boolean;
    invalidSecondMedication?: boolean;
    id_profesional?: number;
  },
): CloseConsultaRequest {
  const preferredId = options.id_profesional ?? SEED_PROFESIONAL_ID;
  const profesional =
    catalog.profesionales.find((p) => p.id_profesional === preferredId) ?? catalog.profesionales[0];
  if (!profesional) {
    throw new Error('fixture catalog missing profesional');
  }
  const med1 =
    catalog.medicamentos.find((m) => m.id_medicamento === SEED_MEDICAMENTO_1) ??
    catalog.medicamentos[0];
  const med2 = options.invalidSecondMedication
    ? { id_medicamento: 9_999_999, nombre_generico: 'missing' }
    : (catalog.medicamentos.find((m) => m.id_medicamento === SEED_MEDICAMENTO_2) ??
      catalog.medicamentos[1] ??
      med1);
  if (!med1) {
    throw new Error('fixture catalog missing medicamento');
  }

  const body: CloseConsultaRequest = {
    id_profesional: profesional.id_profesional,
    fecha_hora_inicio: '2026-11-07T15:00:00.000Z',
    tipo: 'primera_vez',
    motivo_consulta: 'Control',
    enfermedad_actual: null,
    exploracion_fisica: null,
    plan: null,
    diagnosticos: [
      {
        codigo_cie10: SEED_CIE10,
        descripcion: 'Examen general',
        tipo: 'presuntivo',
        es_principal: true,
      },
      {
        codigo_cie10: null,
        descripcion: 'Seguimiento',
        tipo: 'definitivo',
        es_principal: false,
      },
    ],
    tratamientos: [
      {
        diagnostico_index: 0,
        tipo: 'farmacologico',
        descripcion: 'Analgesico',
        indicaciones: null,
        fecha_inicio: '2026-11-07',
        fecha_fin_estimada: null,
        estado: 'activo',
      },
      {
        diagnostico_index: 1,
        tipo: 'reposo',
        descripcion: 'Reposo relativo',
        indicaciones: null,
        fecha_inicio: '2026-11-07',
        fecha_fin_estimada: null,
        estado: 'activo',
      },
    ],
  };

  if (options.withReceta) {
    body.receta = {
      observaciones: null,
      detalles: [
        {
          id_medicamento: med1.id_medicamento,
          dosis: '500mg',
          via_administracion: 'oral',
          frecuencia_horas: 8,
          duracion_dias: 5,
          cantidad: 15,
          indicaciones: null,
        },
        {
          id_medicamento: med2.id_medicamento,
          dosis: '10mg',
          via_administracion: 'oral',
          frecuencia_horas: 12,
          duracion_dias: 3,
          cantidad: 6,
          indicaciones: null,
        },
      ],
    };
  }

  return body;
}

export async function closeBodyFor(
  context: ContractClinicalContext,
  options: {
    withReceta: boolean;
    invalidSecondMedication?: boolean;
    id_profesional?: number;
  },
): Promise<CloseConsultaRequest> {
  const catalog = await context.catalogos.list();
  return closeBodyFromCatalog(catalog, options);
}

export function closeBundleFromRequest(
  id_expediente: ExpedienteId,
  body: CloseConsultaRequest,
  nowIso: string,
): CloseConsultaBundle {
  const detalles: ReadonlyArray<Omit<DetalleRecetaDto, 'id_receta'>> =
    body.receta?.detalles.map((d) => ({
      id_medicamento: d.id_medicamento,
      dosis: d.dosis,
      via_administracion: d.via_administracion,
      frecuencia_horas: d.frecuencia_horas,
      duracion_dias: d.duracion_dias,
      cantidad: d.cantidad,
      indicaciones: d.indicaciones ?? null,
    })) ?? [];

  return {
    consulta: {
      id_expediente,
      id_profesional: body.id_profesional as ProfesionalId,
      id_cita: null,
      fecha_hora_inicio: body.fecha_hora_inicio,
      fecha_hora_fin: nowIso,
      tipo: body.tipo,
      motivo_consulta: body.motivo_consulta,
      enfermedad_actual: body.enfermedad_actual ?? null,
      exploracion_fisica: body.exploracion_fisica ?? null,
      plan: body.plan ?? null,
      estado: 'cerrada',
    },
    diagnosticos: body.diagnosticos.map((d) => ({
      codigo_cie10: d.codigo_cie10 ?? null,
      descripcion: d.descripcion,
      tipo: d.tipo,
      es_principal: d.es_principal,
      fecha_registro: nowIso,
    })),
    tratamientos: body.tratamientos.map((t) => ({
      diagnostico_index: t.diagnostico_index,
      tipo: t.tipo,
      descripcion: t.descripcion,
      indicaciones: t.indicaciones ?? null,
      fecha_inicio: t.fecha_inicio,
      fecha_fin_estimada: t.fecha_fin_estimada ?? null,
      estado: t.estado,
    })),
    ...(body.receta
      ? {
          receta: {
            header: {
              id_profesional: body.id_profesional as ProfesionalId,
              folio: 'REC-PENDING',
              fecha_emision: nowIso,
              observaciones: body.receta.observaciones ?? null,
              estado: 'emitida',
            },
            detalles,
          },
        }
      : {}),
  };
}

export async function closeBundleFor(
  context: ContractClinicalContext,
  id_expediente: ExpedienteId,
  options: {
    withReceta: boolean;
    invalidSecondMedication?: boolean;
    id_profesional?: number;
  },
): Promise<CloseConsultaBundle> {
  const body = await closeBodyFor(context, options);
  return closeBundleFromRequest(id_expediente, body, context.clock.nowIso());
}

export function pediatricKind(): InstitutionKind {
  return 'centro_pediatrico';
}
