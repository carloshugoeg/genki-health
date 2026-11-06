import { describe, expect, it } from 'vitest';
import { createMemoryAdapterSet } from '../config/compose-memory.js';
import { registerPaciente } from './register-paciente.js';

describe('registerPaciente', () => {
  it('creates paciente and expediente on memory adapter', async () => {
    const adapters = createMemoryAdapterSet('hospital_general', 1);
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
    const adapters = createMemoryAdapterSet('hospital_general', 1);
    const input = {
      tipo_documento: 'DPI',
      numero_documento: '999',
      primer_nombre: 'Luis',
      primer_apellido: 'Pérez',
      fecha_nacimiento: '1985-05-05',
      sexo: 'M' as const,
    };
    await registerPaciente(adapters.pacientes, input);
    await expect(registerPaciente(adapters.pacientes, input)).rejects.toThrow(/already exists/);
  });
});
