import { describe, expect, it } from 'vitest';
import { createTestMemoryAdapterSet } from '../config/memory-test-factory.js';
import { registerPaciente } from './register-paciente.js';
import { archiveExpediente } from './archive-expediente.js';

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
});
