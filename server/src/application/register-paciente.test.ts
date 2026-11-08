import { describe, expect, it } from 'vitest';
import type { PacienteResumen, RegisterPacienteRequest, ResponsableInput } from '@genki/shared';
import { createTestMemoryAdapterSet } from '../config/memory-test-factory.js';
import { makeMemoryClinicalHarness } from '../../test/contracts/memory-harness.js';
import { archiveExpediente } from './archive-expediente.js';
import { registerPaciente } from './register-paciente.js';

function adult(
  numero_documento: string,
  overrides: Partial<RegisterPacienteRequest> = {},
): RegisterPacienteRequest {
  return {
    tipo_documento: 'DPI',
    numero_documento,
    primer_nombre: 'Ana',
    primer_apellido: 'López',
    fecha_nacimiento: '1990-01-15',
    sexo: 'F',
    ...overrides,
  };
}

function tutor(
  numero_documento: string,
  es_principal: boolean,
  parentesco: ResponsableInput['parentesco'] = 'madre',
): ResponsableInput {
  return {
    tipo_documento: 'DPI',
    numero_documento,
    nombre_completo: 'Tutor Legal',
    parentesco,
    telefono: '5555-0000',
    es_principal,
  };
}

async function expectClinicalCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (err) {
    expect((err as { code?: string }).code).toBe(code);
    return;
  }
  expect.fail(`expected ClinicalError ${code}`);
}

describe('registerPaciente', () => {
  it('creates paciente and expediente on memory adapter', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    const result = await registerPaciente(adapters.pacientes, {
      tipo_documento: 'DPI',
      numero_documento: '1234567890101',
      primer_nombre: 'Ana',
      primer_apellido: 'López',
      fecha_nacimiento: '1990-01-15',
      sexo: 'F',
    });

    expect(result.paciente.numero_documento).toBe('1234567890101');
    expect(result.expediente.estado).toBe('activo');
    expect(result.expediente.id_paciente).toBe(result.paciente.id_paciente);
  });

  it('rejects duplicate document', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    const input = adult('999', { primer_nombre: 'Luis', primer_apellido: 'Pérez', sexo: 'M' });
    await registerPaciente(adapters.pacientes, input);
    await expectClinicalCode(registerPaciente(adapters.pacientes, input), 'duplicate_document');
  });

  it('register_opens_active_record', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    const result = await registerPaciente(
      adapters.pacientes,
      adult('OPEN-001', { responsables: [] }),
    );

    expect(result.paciente.id_paciente).toBeGreaterThan(0);
    expect(result.paciente.estado).toBe('activo');
    expect(result.paciente.numero_documento).toBe('OPEN-001');
    expect(result.expediente.id_expediente).toBeGreaterThan(0);
    expect(result.expediente.numero_expediente).toBe(`EXP-${result.expediente.id_expediente}`);
    expect(result.expediente.estado).toBe('activo');
    expect(result.expediente.fecha_archivo).toBeNull();
    expect(result.expediente.motivo_archivo).toBeNull();
    expect(result.expediente.observacion_archivo).toBeNull();
    expect(result.expediente.id_paciente).toBe(result.paciente.id_paciente);

    result.paciente.primer_nombre = 'Mutated';
    const stored = await adapters.pacientes.findById(result.paciente.id_paciente);
    expect(stored?.primer_nombre).toBe('Ana');
    expect(stored?.estado).toBe('activo');

    const expediente = await adapters.pacientes.findExpedienteByPaciente(
      result.paciente.id_paciente,
    );
    expect(expediente?.estado).toBe('activo');
    expect(expediente?.numero_expediente).toBe(result.expediente.numero_expediente);
    expect(expediente?.fecha_archivo).toBeNull();
    const byId = await adapters.pacientes.findExpedienteById(result.expediente.id_expediente);
    expect(byId?.id_paciente).toBe(result.paciente.id_paciente);
  });

  it('register_invalid_does_not_open', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    await registerPaciente(hospital.pacientes, adult('999'));
    await expectClinicalCode(
      registerPaciente(hospital.pacientes, {
        ...adult('999'),
        tipo_documento: 'PASAPORTE',
        primer_nombre: 'Otra',
      }),
      'duplicate_document',
    );
    await expectClinicalCode(
      registerPaciente(hospital.pacientes, adult('HOSP-G', { responsables: [tutor('G-1', true)] })),
      'invalid_guardians',
    );

    const lab = createTestMemoryAdapterSet('laboratorio_clinico', 3);
    await expectClinicalCode(
      registerPaciente(lab.pacientes, adult('LAB-1', { responsables: [tutor('L-1', true)] })),
      'invalid_guardians',
    );
    const labPage = await lab.pacientes.list({
      q: '',
      estado: 'todos',
      page: 1,
      page_size: 10,
    });
    expect(labPage.total).toBe(0);

    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    await expectClinicalCode(
      registerPaciente(
        pediatric.pacientes,
        adult('PED-NONE', {
          primer_nombre: 'Nino',
          fecha_nacimiento: '2018-06-01',
          sexo: 'M',
          responsables: [],
        }),
      ),
      'guardian_required',
    );
    await expectClinicalCode(
      registerPaciente(
        pediatric.pacientes,
        adult('PED-TWO', {
          responsables: [tutor('TUT-1', true), tutor('TUT-2', true, 'padre')],
        }),
      ),
      'invalid_guardians',
    );
    await expectClinicalCode(
      registerPaciente(
        pediatric.pacientes,
        adult('PED-ZERO', { responsables: [tutor('TUT-3', false, 'madre')] }),
      ),
      'invalid_guardians',
    );
    const opened = await pediatric.pacientes.list({
      q: '',
      estado: 'todos',
      page: 1,
      page_size: 10,
    });
    expect(opened.total).toBe(0);
    const hospitalDocs = await hospital.pacientes.list({
      q: '999',
      estado: 'todos',
      page: 1,
      page_size: 10,
    });
    expect(hospitalDocs.total).toBe(1);
  });

  it('register_duplicate_matches_numero_alone', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    const created = await registerPaciente(adapters.pacientes, adult('  dpi-9 '));
    expect(created.paciente.numero_documento).toBe('DPI-9');

    const found = await adapters.pacientes.findByDocumento('PASAPORTE', '  dpi-9 ');
    expect(found?.id_paciente).toBe(created.paciente.id_paciente);
    expect(found?.numero_documento).toBe('DPI-9');

    await expectClinicalCode(
      registerPaciente(adapters.pacientes, {
        ...adult('DPI-9'),
        tipo_documento: 'PASAPORTE',
        primer_nombre: 'Otra',
      }),
      'duplicate_document',
    );
    const page = await adapters.pacientes.list({
      q: 'DPI-9',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
  });

  it('register_pediatric_guardians_persist_with_expediente', async () => {
    const harness = await makeMemoryClinicalHarness({ kind: 'centro_pediatrico' });
    const before = await harness.counts();
    const pair = await harness.context.pacientes.createWithExpediente(
      adult('PED-OK', {
        primer_nombre: 'Nino',
        fecha_nacimiento: '2018-06-01',
        sexo: 'M',
        responsables: [tutor('TUT-1', true), tutor('TUT-2', false, 'padre')],
      }),
    );
    expect(pair.expediente.estado).toBe('activo');
    expect(pair.paciente.estado).toBe('activo');
    const afterPair = await harness.counts();
    expect(afterPair.pacientes).toBe(before.pacientes + 1);
    expect(afterPair.expedientes).toBe(before.expedientes + 1);
    expect(afterPair.responsables).toBe(before.responsables + 2);

    const single = await harness.context.pacientes.createWithExpediente(
      adult('PED-ONE', {
        responsables: [tutor('TUT-9', true)],
      }),
    );
    expect(single.expediente.estado).toBe('activo');
    const afterSingle = await harness.counts();
    expect(afterSingle.pacientes).toBe(before.pacientes + 2);
    expect(afterSingle.expedientes).toBe(before.expedientes + 2);
    expect(afterSingle.responsables).toBe(before.responsables + 3);
  });

  it('list_matches_document_record_name_and_page', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    const created: PacienteResumen[] = [];
    created.push(
      await registerPaciente(
        adapters.pacientes,
        adult('SEARCH-001', { primer_nombre: 'Maria', primer_apellido: 'Quetzal' }),
      ),
    );
    created.push(
      await registerPaciente(
        adapters.pacientes,
        adult('SEARCH-002', { primer_nombre: 'Pedro', primer_apellido: 'Quetzal' }),
      ),
    );
    created.push(
      await registerPaciente(
        adapters.pacientes,
        adult('SEARCH-003', { primer_nombre: 'Lucia', primer_apellido: 'Bosque' }),
      ),
    );
    created.push(
      await registerPaciente(
        adapters.pacientes,
        adult('ACCENT-001', {
          primer_nombre: 'Ana',
          segundo_nombre: 'María',
          primer_apellido: 'López',
          segundo_apellido: 'García',
        }),
      ),
    );
    created.push(
      await registerPaciente(
        adapters.pacientes,
        adult('LITERAL-001', { primer_nombre: 'Literal', primer_apellido: '%_.*' }),
      ),
    );

    const byName = await adapters.pacientes.list({
      q: 'Quetzal',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(byName.total).toBe(2);
    expect(byName.items).toHaveLength(2);
    expect(byName.page).toBe(1);
    expect(byName.page_size).toBe(10);

    const byNameFold = await adapters.pacientes.list({
      q: '  quetzal ',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(byNameFold.total).toBe(2);

    const byDoc = await adapters.pacientes.list({
      q: 'SEARCH-003',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(byDoc.total).toBe(1);
    expect(byDoc.items[0]?.paciente.numero_documento).toBe('SEARCH-003');

    const byPrefix = await adapters.pacientes.list({
      q: 'SEARCH',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(byPrefix.total).toBe(0);

    const byExp = await adapters.pacientes.list({
      q: created[0]!.expediente.numero_expediente,
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(byExp.total).toBe(1);
    expect(byExp.items[0]?.paciente.id_paciente).toBe(created[0]!.paciente.id_paciente);

    const byAccent = await adapters.pacientes.list({
      q: 'maría lópez',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(byAccent.total).toBe(1);
    expect(byAccent.items[0]?.paciente.numero_documento).toBe('ACCENT-001');

    const foldedAccent = await adapters.pacientes.list({
      q: 'lopez',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(foldedAccent.total).toBe(0);

    const literalMeta = await adapters.pacientes.list({
      q: '%_.*',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(literalMeta.total).toBe(1);
    expect(literalMeta.items[0]?.paciente.numero_documento).toBe('LITERAL-001');

    const ids = created.map((row) => row.paciente.id_paciente).sort((a, b) => a - b);
    const page1 = await adapters.pacientes.list({
      q: '',
      estado: 'activo',
      page: 1,
      page_size: 1,
    });
    expect(page1.total).toBe(5);
    expect(page1.page).toBe(1);
    expect(page1.page_size).toBe(1);
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0]?.paciente.id_paciente).toBe(ids[0]);

    const page2 = await adapters.pacientes.list({
      q: '',
      estado: 'activo',
      page: 2,
      page_size: 1,
    });
    expect(page2.total).toBe(5);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]?.paciente.id_paciente).toBe(ids[1]);

    const past = await adapters.pacientes.list({
      q: '',
      estado: 'activo',
      page: 9,
      page_size: 1,
    });
    expect(past.total).toBe(5);
    expect(past.items).toEqual([]);
    expect(past.page).toBe(9);
    expect(past.page_size).toBe(1);

    await archiveExpediente(adapters.pacientes, adapters.clock, {
      id_paciente: created[2]!.paciente.id_paciente,
      id_expediente: created[2]!.expediente.id_expediente,
      motivo_archivo: 'administrativo',
    });

    const activeDoc = await adapters.pacientes.list({
      q: 'SEARCH-003',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(activeDoc.total).toBe(0);
    const archivedDoc = await adapters.pacientes.list({
      q: 'SEARCH-003',
      estado: 'archivado',
      page: 1,
      page_size: 10,
    });
    expect(archivedDoc.total).toBe(1);
    const todos = await adapters.pacientes.list({
      q: '',
      estado: 'todos',
      page: 1,
      page_size: 10,
    });
    expect(todos.total).toBe(5);
    const activeAll = await adapters.pacientes.list({
      q: '',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(activeAll.total).toBe(4);
  });

  it('register_failure_after_paciente_rolls_back', async () => {
    const harness = await makeMemoryClinicalHarness({ kind: 'centro_pediatrico' });
    const before = await harness.counts();
    await harness.context.pacientes.createWithExpediente(
      adult('PED-BASE', {
        responsables: [tutor('TUT-1', true), tutor('TUT-2', false, 'padre')],
      }),
    );
    const mid = await harness.counts();
    expect(mid.pacientes).toBe(before.pacientes + 1);
    expect(mid.expedientes).toBe(before.expedientes + 1);
    expect(mid.responsables).toBe(before.responsables + 2);

    harness.failNext('afterPaciente');
    await expect(
      harness.context.pacientes.createWithExpediente(
        adult('PED-FAIL', {
          responsables: [tutor('TUT-3', true), tutor('TUT-4', false, 'padre')],
        }),
      ),
    ).rejects.toBeTruthy();

    expect(await harness.counts()).toEqual(mid);
    expect(await harness.context.pacientes.findByDocumento('DPI', 'PED-FAIL')).toBeNull();
    expect(await harness.context.pacientes.findByDocumento('DPI', 'PED-BASE')).not.toBeNull();
  });
});
