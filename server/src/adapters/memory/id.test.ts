import { describe, expect, it } from 'vitest';
import type { CreatePacienteInput } from '../../ports/index.js';
import { createTestMemoryAdapterSet } from '../../config/memory-test-factory.js';
import { MemoryIdPort } from './id.js';

function sampleInput(doc: string): CreatePacienteInput {
  return {
    tipo_documento: 'DPI',
    numero_documento: doc,
    primer_nombre: 'Ana',
    primer_apellido: 'Prueba',
    fecha_nacimiento: '1990-01-15',
    sexo: 'F',
  };
}

describe('MemoryIdPort shared domain', () => {
  it('same_memory_domain_allocates_distinct_patient_and_expediente_ids_across_institutions', async () => {
    const sequences = new MemoryIdPort();
    const primary = createTestMemoryAdapterSet('hospital_general', 1, { ids: sequences });
    const other = createTestMemoryAdapterSet('hospital_general', 99, { ids: sequences });

    const local = await primary.pacientes.createWithExpediente(sampleInput('SEQ-LOCAL-1'));
    const foreign = await other.pacientes.createWithExpediente(sampleInput('SEQ-FOREIGN-1'));

    expect(foreign.paciente.id_paciente).not.toBe(local.paciente.id_paciente);
    expect(foreign.expediente.id_expediente).not.toBe(local.expediente.id_expediente);
    expect(await primary.pacientes.findById(foreign.paciente.id_paciente)).toBeNull();
    expect(await other.pacientes.findById(local.paciente.id_paciente)).toBeNull();
  });

  it('rollback_does_not_rewind_other_institution_committed_sequences', async () => {
    const sequences = new MemoryIdPort();
    const primary = createTestMemoryAdapterSet('hospital_general', 1, { ids: sequences });
    const other = createTestMemoryAdapterSet('hospital_general', 99, { ids: sequences });

    const committed = await other.pacientes.createWithExpediente(sampleInput('SEQ-OTHER-OK'));
    await expect(
      primary.unitOfWork.runInTransaction(async () => {
        await primary.pacientes.createWithExpediente(sampleInput('SEQ-PRIMARY-FAIL'));
        throw new Error('outer boom');
      }),
    ).rejects.toThrow(/outer boom/);

    const again = await other.pacientes.createWithExpediente(sampleInput('SEQ-OTHER-2'));
    expect(again.paciente.id_paciente).toBeGreaterThan(committed.paciente.id_paciente);
    expect(await primary.pacientes.findByDocumento('DPI', 'SEQ-PRIMARY-FAIL')).toBeNull();
    expect(await other.pacientes.findById(committed.paciente.id_paciente)).not.toBeNull();
  });

  it('all_memory_repositories_share_named_sequence_source', async () => {
    const sequences = new MemoryIdPort();
    const set = createTestMemoryAdapterSet('hospital_general', 1, { ids: sequences });
    expect(set.ids).toBe(sequences);
    const first = await sequences.nextInt('paciente');
    const viaRepo = await set.pacientes.createWithExpediente(sampleInput('SEQ-SHARE-1'));
    expect(viaRepo.paciente.id_paciente).toBe(first + 1);
  });
});
