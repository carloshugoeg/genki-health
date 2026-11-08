import { describe, expect, it } from 'vitest';
import {
  asExpedienteId,
  asPacienteId,
  type MotivoArchivo,
  type RegisterPacienteRequest,
} from '@genki/shared';
import { createTestMemoryAdapterSet } from '../config/memory-test-factory.js';
import { archiveExpediente } from './archive-expediente.js';
import { registerPaciente } from './register-paciente.js';

function adult(numero_documento: string): RegisterPacienteRequest {
  return {
    tipo_documento: 'DPI',
    numero_documento,
    primer_nombre: 'Ana',
    primer_apellido: 'López',
    fecha_nacimiento: '1990-01-15',
    sexo: 'F',
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

describe('archiveExpediente', () => {
  it('archives expediente without writing archivado onto paciente', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    const { paciente, expediente } = await registerPaciente(adapters.pacientes, {
      tipo_documento: 'DPI',
      numero_documento: '111',
      primer_nombre: 'Ana',
      primer_apellido: 'López',
      fecha_nacimiento: '1990-01-15',
      sexo: 'F',
    });

    const archived = await archiveExpediente(adapters.pacientes, adapters.clock, {
      id_paciente: paciente.id_paciente,
      id_expediente: expediente.id_expediente,
      motivo_archivo: 'traslado',
    });

    expect(archived.estado).toBe('archivado');
    expect(archived.motivo_archivo).toBe('traslado');
    const still = await adapters.pacientes.findById(paciente.id_paciente);
    expect(still?.estado).toBe('activo');
  });

  it('archive_active_record', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    const { paciente, expediente } = await registerPaciente(adapters.pacientes, adult('ARCH-001'));

    const archived = await archiveExpediente(adapters.pacientes, adapters.clock, {
      id_paciente: paciente.id_paciente,
      id_expediente: expediente.id_expediente,
      motivo_archivo: 'traslado',
      observacion_archivo: 'se muda',
    });

    expect(archived.estado).toBe('archivado');
    expect(archived.motivo_archivo).toBe('traslado');
    expect(archived.observacion_archivo).toBe('se muda');
    expect(archived.fecha_archivo).toEqual(expect.any(String));
    expect(archived.id_expediente).toBe(expediente.id_expediente);
    expect(archived.id_paciente).toBe(paciente.id_paciente);

    const still = await adapters.pacientes.findById(paciente.id_paciente);
    expect(still?.estado).toBe('activo');
    const stored = await adapters.pacientes.findExpedienteById(expediente.id_expediente);
    expect(stored?.estado).toBe('archivado');
    expect(stored?.motivo_archivo).toBe('traslado');
    expect(stored?.fecha_archivo).toBe(archived.fecha_archivo);
    expect(stored?.observacion_archivo).toBe('se muda');

    const active = await adapters.pacientes.list({
      q: 'ARCH-001',
      estado: 'activo',
      page: 1,
      page_size: 10,
    });
    expect(active.total).toBe(0);
    const archivedList = await adapters.pacientes.list({
      q: 'ARCH-001',
      estado: 'archivado',
      page: 1,
      page_size: 10,
    });
    expect(archivedList.total).toBe(1);
    const todos = await adapters.pacientes.list({
      q: 'ARCH-001',
      estado: 'todos',
      page: 1,
      page_size: 10,
    });
    expect(todos.total).toBe(1);
  });

  it('archive_invalid_reason_unchanged', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    const { paciente, expediente } = await registerPaciente(adapters.pacientes, adult('ARCH-BAD'));

    await expectClinicalCode(
      archiveExpediente(adapters.pacientes, adapters.clock, {
        id_paciente: paciente.id_paciente,
        id_expediente: expediente.id_expediente,
        motivo_archivo: 'transferencia' as MotivoArchivo,
      }),
      'invalid_body',
    );

    const stored = await adapters.pacientes.findExpedienteByPaciente(paciente.id_paciente);
    expect(stored?.estado).toBe('activo');
    expect(stored?.motivo_archivo).toBeNull();
    expect(stored?.fecha_archivo).toBeNull();
    expect(stored?.observacion_archivo).toBeNull();
    const still = await adapters.pacientes.findById(paciente.id_paciente);
    expect(still?.estado).toBe('activo');
  });

  it('archive_archived_record_rejected', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    const { paciente, expediente } = await registerPaciente(
      adapters.pacientes,
      adult('ARCH-TWICE'),
    );
    const first = await archiveExpediente(adapters.pacientes, adapters.clock, {
      id_paciente: paciente.id_paciente,
      id_expediente: expediente.id_expediente,
      motivo_archivo: 'traslado',
      observacion_archivo: 'primero',
    });

    await expectClinicalCode(
      archiveExpediente(adapters.pacientes, adapters.clock, {
        id_paciente: paciente.id_paciente,
        id_expediente: expediente.id_expediente,
        motivo_archivo: 'fallecimiento',
      }),
      'already_archived',
    );

    const again = await adapters.pacientes.findExpedienteById(expediente.id_expediente);
    expect(again?.estado).toBe('archivado');
    expect(again?.motivo_archivo).toBe(first.motivo_archivo);
    expect(again?.fecha_archivo).toBe(first.fecha_archivo);
    expect(again?.observacion_archivo).toBe('primero');
    const still = await adapters.pacientes.findById(paciente.id_paciente);
    expect(still?.estado).toBe('activo');
  });

  it('archive_unknown_record_rejected', async () => {
    const local = createTestMemoryAdapterSet('hospital_general', 1);
    await expectClinicalCode(
      archiveExpediente(local.pacientes, local.clock, {
        id_paciente: asPacienteId(900001),
        id_expediente: asExpedienteId(900001),
        motivo_archivo: 'traslado',
      }),
      'not_found',
    );

    const { paciente, expediente } = await registerPaciente(local.pacientes, adult('ARCH-LOCAL'));
    await expectClinicalCode(
      archiveExpediente(local.pacientes, local.clock, {
        id_paciente: paciente.id_paciente,
        id_expediente: asExpedienteId(expediente.id_expediente + 50),
        motivo_archivo: 'administrativo',
      }),
      'not_found',
    );
    const localStill = await local.pacientes.findExpedienteById(expediente.id_expediente);
    expect(localStill?.estado).toBe('activo');
    expect(localStill?.motivo_archivo).toBeNull();

    const other = createTestMemoryAdapterSet('hospital_general', 99);
    const foreign = await registerPaciente(other.pacientes, adult('ARCH-FOREIGN'));
    const emptyLocal = createTestMemoryAdapterSet('clinica_odontologica', 4);
    await expectClinicalCode(
      archiveExpediente(emptyLocal.pacientes, emptyLocal.clock, {
        id_paciente: foreign.paciente.id_paciente,
        id_expediente: foreign.expediente.id_expediente,
        motivo_archivo: 'inactividad',
      }),
      'not_found',
    );
    const foreignStill = await other.pacientes.findExpedienteById(foreign.expediente.id_expediente);
    expect(foreignStill?.estado).toBe('activo');
    expect(foreignStill?.fecha_archivo).toBeNull();
    const localPatient = await local.pacientes.findById(paciente.id_paciente);
    expect(localPatient?.estado).toBe('activo');
  });
});
