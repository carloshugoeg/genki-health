import type { RegisterPacienteRequest, ResponsableInput } from '@genki/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { ClinicalError } from '../../domain/clinical-error.js';
import { SEED_MUNICIPIO_ID } from '../../testing/catalog-seeds.js';
import { assertCountsEqual, type ClinicalHarness } from '../../testing/harness.js';
import {
  closeMysqlHarnessSharedClient,
  makeMysqlClinicalHarness,
} from '../../testing/mysql-harness.js';

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

function pediatricRegisterInput(
  variant: 'none' | 'two_principal' | 'valid_pair',
  numero_documento = 'PED-0001',
): RegisterPacienteRequest {
  const base: RegisterPacienteRequest = {
    tipo_documento: 'DPI',
    numero_documento,
    primer_nombre: 'Nino',
    segundo_nombre: null,
    primer_apellido: 'Garcia',
    segundo_apellido: null,
    fecha_nacimiento: '2018-06-01',
    sexo: 'M',
    tipo_sangre: null,
    telefono: null,
    correo: null,
    direccion: null,
    id_municipio: SEED_MUNICIPIO_ID,
  };
  if (variant === 'none') {
    return { ...base, responsables: [] };
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

describe('MySQL paciente repository (E2-P3B-02)', () => {
  let harness: ClinicalHarness;

  afterAll(async () => {
    await closeMysqlHarnessSharedClient();
  }, 30_000);

  async function boot(): Promise<ClinicalHarness> {
    const next = await makeMysqlClinicalHarness({ kind: 'centro_pediatrico' });
    await next.reset();
    return next;
  }

  it('mysql_guardians_precede_expediente', async () => {
    harness = await boot();
    await expectClinicalCode(
      harness.context.pacientes.createWithExpediente(pediatricRegisterInput('none')),
      'guardian_required',
    );
    await expectClinicalCode(
      harness.context.pacientes.createWithExpediente(pediatricRegisterInput('two_principal')),
      'invalid_guardians',
    );
    const before = await harness.counts();
    expect(before.expedientes).toBe(0);
    expect(before.responsables).toBe(0);
    const ok = await harness.context.pacientes.createWithExpediente(
      pediatricRegisterInput('valid_pair'),
    );
    expect(ok.paciente.id_paciente).toBeGreaterThan(0);
    expect(ok.expediente.id_expediente).toBeGreaterThan(0);
    expect(ok.expediente.numero_expediente).toBe(`EXP-${ok.expediente.id_expediente}`);
    expect(ok.expediente.estado).toBe('activo');
    const after = await harness.counts();
    expect(after.pacientes).toBe(1);
    expect(after.expedientes).toBe(1);
    expect(after.responsables).toBe(2);
    await harness.close();
  });

  it('mysql_registration_failure_rolls_back_guardians', async () => {
    harness = await boot();
    const before = await harness.counts();
    harness.failNext('afterPaciente');
    await expect(
      harness.context.pacientes.createWithExpediente(pediatricRegisterInput('valid_pair')),
    ).rejects.toBeTruthy();
    assertCountsEqual(await harness.counts(), before);
    await harness.close();
  });

  it('mysql_duplicate_document_is_race_safe', async () => {
    harness = await boot();
    const input = pediatricRegisterInput('valid_pair', 'RACE-001');
    const results = await Promise.allSettled([
      harness.context.pacientes.createWithExpediente(input),
      harness.context.pacientes.createWithExpediente({
        ...input,
        primer_nombre: 'Clone',
        responsables: [
          guardian({ numero_documento: 'TUT-R1', es_principal: true }),
          guardian({
            numero_documento: 'TUT-R2',
            es_principal: false,
            parentesco: 'padre',
          }),
        ],
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(errorCode((rejected[0] as PromiseRejectedResult).reason)).toBe('duplicate_document');
    const counts = await harness.counts();
    expect(counts.pacientes).toBe(1);
    expect(counts.expedientes).toBe(1);
    await harness.close();
  });

  it('mysql_archive_hides_active_search', async () => {
    harness = await boot();
    const patient = await harness.context.pacientes.createWithExpediente(
      pediatricRegisterInput('valid_pair', 'ARCH-001'),
    );
    const archived = await harness.context.pacientes.archiveExpediente({
      id_expediente: patient.expediente.id_expediente,
      motivo_archivo: 'administrativo',
      fecha_archivo: harness.context.clock.nowIso(),
      observacion_archivo: 'demo',
    });
    expect(archived.estado).toBe('archivado');
    const refreshed = await harness.context.pacientes.findById(patient.paciente.id_paciente);
    expect(refreshed?.estado).toBe('activo');
    const active = await harness.context.pacientes.list({
      q: 'ARCH-001',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(active.total).toBe(0);
    const archivedList = await harness.context.pacientes.list({
      q: 'ARCH-001',
      estado: 'archivado',
      page: 1,
      page_size: 10,
    });
    expect(archivedList.total).toBe(1);
    const todos = await harness.context.pacientes.list({
      q: 'ARCH-001',
      estado: 'todos',
      page: 1,
      page_size: 10,
    });
    expect(todos.total).toBe(1);
    await harness.close();
  });
});
