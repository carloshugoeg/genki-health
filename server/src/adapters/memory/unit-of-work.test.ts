import { describe, expect, it } from 'vitest';
import type { PacienteId } from '@genki/shared';
import { createTestMemoryAdapterSet } from '../../config/memory-test-factory.js';
import type { CreatePacienteInput } from '../../ports/index.js';

function sampleInput(doc: string, name: string): CreatePacienteInput {
  return {
    tipo_documento: 'DPI',
    numero_documento: doc,
    primer_nombre: name,
    primer_apellido: 'Prueba',
    fecha_nacimiento: '1990-01-15',
    sexo: 'F',
  };
}

describe('MemoryUnitOfWork', () => {
  it('uow_nested_join_rolls_back_with_outer_failure', async () => {
    const set = createTestMemoryAdapterSet('hospital_general', 1);
    let createdId: PacienteId | undefined;

    await expect(
      set.unitOfWork.runInTransaction(async () => {
        await set.unitOfWork.runInTransaction(async () => {
          const { paciente } = await set.pacientes.createWithExpediente(
            sampleInput('nested-rollback-1', 'Nidia'),
          );
          createdId = paciente.id_paciente;
        });
        throw new Error('outer boom');
      }),
    ).rejects.toThrow(/outer boom/);

    expect(createdId).toBeDefined();
    expect(await set.pacientes.findById(createdId!)).toBeNull();
    expect(await set.pacientes.findByDocumento('DPI', 'nested-rollback-1')).toBeNull();
  });

  it('uow_outside_reader_misses_uncommitted_writes', async () => {
    const set = createTestMemoryAdapterSet('hospital_general', 1);
    let releaseHold!: () => void;
    const hold = new Promise<void>((resolve) => {
      releaseHold = resolve;
    });
    let signalWrote!: () => void;
    const wrote = new Promise<void>((resolve) => {
      signalWrote = resolve;
    });

    const writer = set.unitOfWork.runInTransaction(async () => {
      await set.pacientes.createWithExpediente(sampleInput('partial-1', 'Parcial'));
      signalWrote();
      await hold;
    });

    await wrote;
    expect(await set.pacientes.findByDocumento('DPI', 'partial-1')).toBeNull();

    releaseHold();
    await writer;
    expect(await set.pacientes.findByDocumento('DPI', 'partial-1')).not.toBeNull();
  });

  it('uow_concurrent_writers_serialize', async () => {
    const set = createTestMemoryAdapterSet('hospital_general', 1);
    let phaseA = 0;
    let phaseB = 0;
    let releaseA!: () => void;
    const holdA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    let signalEnteredA!: () => void;
    const enteredA = new Promise<void>((resolve) => {
      signalEnteredA = resolve;
    });

    const first = set.unitOfWork.runInTransaction(async () => {
      phaseA = 1;
      signalEnteredA();
      await set.pacientes.createWithExpediente(sampleInput('serial-a', 'Alpha'));
      await holdA;
      phaseA = 2;
    });

    await enteredA;
    expect(phaseA).toBe(1);

    const secondPromise = set.unitOfWork.runInTransaction(async () => {
      expect(phaseA).toBe(2);
      phaseB = 1;
      await set.pacientes.createWithExpediente(sampleInput('serial-b', 'Beta'));
      phaseB = 2;
    });

    await Promise.resolve();
    expect(phaseB).toBe(0);

    releaseA();
    await Promise.all([first, secondPromise]);
    expect(phaseB).toBe(2);
    expect(await set.pacientes.findByDocumento('DPI', 'serial-a')).not.toBeNull();
    expect(await set.pacientes.findByDocumento('DPI', 'serial-b')).not.toBeNull();
  });

  it('memory_returned_dto_is_clone', async () => {
    const set = createTestMemoryAdapterSet('hospital_general', 1);
    const { paciente } = await set.pacientes.createWithExpediente(sampleInput('clone-1', 'Clara'));
    paciente.primer_nombre = 'MUTATED';
    const again = await set.pacientes.findById(paciente.id_paciente);
    expect(again?.primer_nombre).toBe('Clara');
  });
});
