import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RegisterPacienteRequest, ResponsableInput } from '@genki/shared';
import { ClinicalError } from '../../domain/clinical-error.js';
import { assertCountsEqual, type ClinicalHarness } from '../../testing/harness.js';
import {
  closePostgresHarnessShared,
  makePostgresClinicalHarness,
} from '../../testing/postgres-harness.js';
import { SEED_MUNICIPIO_ID } from '../../testing/catalog-seeds.js';
import type { InstitutionKind } from '@genki/shared';

function guardian(
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

function baseRegisterInput(
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

function pediatricRegisterInput(
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

function threeSearchPatients(): RegisterPacienteRequest[] {
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

function pediatricKind(): InstitutionKind {
  return 'centro_pediatrico';
}

function errorCode(err: unknown): string | undefined {
  if (err instanceof ClinicalError) {
    return err.code;
  }
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

async function expectClinicalCode(
  promise: Promise<unknown>,
  code: ClinicalError['code'],
): Promise<void> {
  try {
    await promise;
    expect.fail(`expected ClinicalError ${code}`);
  } catch (err) {
    expect(errorCode(err)).toBe(code);
  }
}

describe('PostgreSQL paciente repository (E2-P3A-03)', () => {
  let harness: ClinicalHarness;

  beforeAll(async () => {
    harness = await makePostgresClinicalHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
    await closePostgresHarnessShared();
  }, 30_000);

  it('pg_registration_is_atomic', async () => {
    const pediatric = await makePostgresClinicalHarness({ kind: pediatricKind() });
    await pediatric.reset();
    const before = await pediatric.counts();
    pediatric.failNext('afterPaciente');
    await expect(
      pediatric.context.pacientes.createWithExpediente(pediatricRegisterInput('valid_pair')),
    ).rejects.toBeTruthy();
    assertCountsEqual(await pediatric.counts(), before);

    const created = await pediatric.context.pacientes.createWithExpediente(
      pediatricRegisterInput('valid_pair'),
    );
    expect(created.paciente.id_paciente).toBeGreaterThan(0);
    expect(created.expediente.id_expediente).toBeGreaterThan(0);
    expect(created.expediente.numero_expediente).toBe(`EXP-${created.expediente.id_expediente}`);
    expect(created.expediente.estado).toBe('activo');
    expect(created.expediente.fecha_archivo).toBeNull();
    expect(created.expediente.motivo_archivo).toBeNull();
    expect(created.expediente.observacion_archivo).toBeNull();
    const after = await pediatric.counts();
    expect(after.pacientes).toBe(before.pacientes + 1);
    expect(after.expedientes).toBe(before.expedientes + 1);
    expect(after.responsables).toBe(before.responsables + 2);
    await pediatric.close();
  });

  it('pg_duplicate_doc_different_type_rejected', async () => {
    await harness.reset();
    const first = baseRegisterInput({ numero_documento: 'DUP-001', tipo_documento: 'DPI' });
    await harness.context.pacientes.createWithExpediente(first);
    const before = await harness.counts();
    await expectClinicalCode(
      harness.context.pacientes.createWithExpediente({
        ...first,
        tipo_documento: 'PASAPORTE',
        primer_nombre: 'Otra',
      }),
      'duplicate_document',
    );
    assertCountsEqual(await harness.counts(), before);
  });

  it('pg_archive_checks_patient_scope', async () => {
    await harness.reset();
    const local = await harness.context.pacientes.createWithExpediente(
      baseRegisterInput({ numero_documento: 'ARCH-LOCAL' }),
    );
    const other = await harness.otherInstitution();
    const foreign = await other.pacientes.createWithExpediente(
      baseRegisterInput({ numero_documento: 'ARCH-FOREIGN' }),
    );

    await expectClinicalCode(
      harness.context.pacientes.archiveExpediente({
        id_expediente: foreign.expediente.id_expediente,
        motivo_archivo: 'administrativo',
        fecha_archivo: harness.context.clock.nowIso(),
      }),
      'not_found',
    );

    const fecha = '2026-11-08T19:00:00.000Z';
    const archived = await harness.context.pacientes.archiveExpediente({
      id_expediente: local.expediente.id_expediente,
      motivo_archivo: 'traslado',
      fecha_archivo: fecha,
    });
    expect(archived.estado).toBe('archivado');
    expect(archived.fecha_archivo).toBe(fecha);
    expect(archived.motivo_archivo).toBe('traslado');
    expect(archived.observacion_archivo).toBeNull();

    const patient = await harness.context.pacientes.findById(local.paciente.id_paciente);
    expect(patient?.estado).toBe('activo');

    await expectClinicalCode(
      harness.context.pacientes.archiveExpediente({
        id_expediente: local.expediente.id_expediente,
        motivo_archivo: 'inactividad',
        fecha_archivo: harness.context.clock.nowIso(),
        observacion_archivo: 'should not overwrite',
      }),
      'already_archived',
    );
    const again = await harness.context.pacientes.findExpedienteById(
      local.expediente.id_expediente,
    );
    expect(again?.fecha_archivo).toBe(fecha);
    expect(again?.motivo_archivo).toBe('traslado');
    expect(again?.observacion_archivo).toBeNull();
  });

  it('pg_literal_search_and_pagination', async () => {
    await harness.reset();
    const created = [];
    for (const input of threeSearchPatients()) {
      created.push(await harness.context.pacientes.createWithExpediente(input));
    }

    const byName = await harness.context.pacientes.list({
      q: 'Quetzal',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(byName.total).toBe(2);
    expect(byName.items).toHaveLength(2);

    const byDoc = await harness.context.pacientes.list({
      q: 'SEARCH-003',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(byDoc.total).toBe(1);
    expect(byDoc.items[0]?.paciente.numero_documento).toBe('SEARCH-003');

    const byExp = await harness.context.pacientes.list({
      q: created[0]!.expediente.numero_expediente,
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(byExp.total).toBe(1);

    const page1 = await harness.context.pacientes.list({
      q: '',
      estado: 'activo',
      page: 1,
      page_size: 1,
    });
    expect(page1.total).toBe(3);
    expect(page1.items).toHaveLength(1);
    const page2 = await harness.context.pacientes.list({
      q: '',
      estado: 'activo',
      page: 2,
      page_size: 1,
    });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]?.paciente.id_paciente).not.toBe(page1.items[0]?.paciente.id_paciente);

    const literalMeta = await harness.context.pacientes.list({
      q: '%_.*',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(literalMeta.total).toBe(0);
  });
});
