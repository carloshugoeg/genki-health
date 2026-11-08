import { afterEach, describe, expect, it } from 'vitest';
import { asExpedienteId, type InstitutionKind, type RegisterPacienteRequest } from '@genki/shared';
import type { ClinicalContext, PersistenceCheckpoint } from '../../ports/index.js';

// Runtime import keeps server/test fixtures outside the production tsconfig rootDir.
const harnessUrl = new URL('../../../test/contracts/firebase-harness.ts', import.meta.url).href;
interface PatientHarness {
  context: Pick<ClinicalContext, 'pacientes' | 'catalogos' | 'unitOfWork' | 'clock' | 'ids'>;
  reset(): Promise<void>;
  counts(): Promise<Record<string, number>>;
  failNext(point: PersistenceCheckpoint): void;
  otherInstitution(): Promise<PatientHarness['context']>;
  close(): Promise<void>;
}
const { makeFirebasePatientHarness } = (await import(harnessUrl)) as {
  makeFirebasePatientHarness(options?: { kind?: InstitutionKind }): Promise<PatientHarness>;
};
function input(numero_documento: string, primer_nombre = 'Ana'): RegisterPacienteRequest {
  return {
    tipo_documento: 'DPI',
    numero_documento,
    primer_nombre,
    primer_apellido: 'Lopez',
    fecha_nacimiento: '1990-01-15',
    sexo: 'F',
    id_municipio: 1,
  };
}
let harness: PatientHarness | undefined;
async function boot(kind?: InstitutionKind) {
  harness = await makeFirebasePatientHarness(kind ? { kind } : {});
  await harness.reset();
  return harness;
}
afterEach(async () => {
  await harness?.close();
  harness = undefined;
});

describe('Firestore patient slice (requires physical emulator)', () => {
  it('firestore_document_reservation_has_one_winner', async () => {
    const h = await boot();
    const results = await Promise.allSettled([
      h.context.pacientes.createWithExpediente(input(' doc/001 ')),
      h.context.pacientes.createWithExpediente({
        ...input('DOC/001'),
        tipo_documento: 'PASAPORTE',
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'duplicate_document' });
    expect(await h.counts()).toMatchObject({ patients: 1, records: 1, documentKeys: 1 });
    expect(await h.context.pacientes.findByDocumento('OTRO', ' doc/001 ')).toMatchObject({
      numero_documento: 'DOC/001',
    });
  });

  it('firestore_patient_failure_leaves_no_reservation', async () => {
    const h = await boot();
    const before = await h.counts();
    h.failNext('afterPaciente');
    await expect(h.context.pacientes.createWithExpediente(input('FAIL'))).rejects.toThrow(
      'injected afterPaciente',
    );
    expect(await h.counts()).toEqual(before);
    expect(await h.context.pacientes.findByDocumento('DPI', 'FAIL')).toBeNull();
    const saved = await h.context.pacientes.createWithExpediente(input('FAIL'));
    expect(saved.paciente.id_paciente).toBe(1);
    expect(saved.expediente.id_expediente).toBe(101);
    expect(await h.context.pacientes.findExpedienteByPaciente(saved.paciente.id_paciente)).toEqual(
      saved.expediente,
    );
  });

  it('firestore_archive_preserves_patient_state', async () => {
    const h = await boot();
    const saved = await h.context.pacientes.createWithExpediente(input('ARCHIVE'));
    const archive = {
      id_expediente: saved.expediente.id_expediente,
      motivo_archivo: 'administrativo' as const,
      fecha_archivo: h.context.clock.nowIso(),
    };
    const archived = await h.context.pacientes.archiveExpediente(archive);
    expect(archived).toEqual({
      ...saved.expediente,
      estado: 'archivado',
      motivo_archivo: 'administrativo',
      fecha_archivo: archive.fecha_archivo,
    });
    expect(await h.context.pacientes.findById(saved.paciente.id_paciente)).toEqual(saved.paciente);
    expect(await h.context.pacientes.findExpedienteById(saved.expediente.id_expediente)).toEqual(
      archived,
    );
    await expect(h.context.pacientes.archiveExpediente(archive)).rejects.toMatchObject({
      code: 'already_archived',
    });
    const other = await h.otherInstitution();
    expect(await other.pacientes.findById(saved.paciente.id_paciente)).toBeNull();
    const otherSaved = await other.pacientes.createWithExpediente(input('ARCHIVE'));
    expect(otherSaved.paciente.id_paciente).toBe(saved.paciente.id_paciente);
    expect(
      (await other.pacientes.findExpedienteByPaciente(otherSaved.paciente.id_paciente))?.estado,
    ).toBe('activo');
    saved.paciente.primer_nombre = 'Mutación externa';
    expect((await h.context.pacientes.findById(saved.paciente.id_paciente))?.primer_nombre).toBe(
      'Ana',
    );
    await expect(other.pacientes.archiveExpediente(archive)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(
      h.context.pacientes.archiveExpediente({ ...archive, id_expediente: asExpedienteId(999) }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('firestore_literal_search_total_is_exact', async () => {
    const h = await boot();
    const a = await h.context.pacientes.createWithExpediente(input('DOC-1', 'Ana %_.*'));
    await h.context.pacientes.createWithExpediente(input('DOC-2', 'Ana'));
    const b = await h.context.pacientes.createWithExpediente(input('DOC-3', 'Ana'));
    const list = (q: string, estado: 'activo' | 'archivado' | 'todos' = 'activo', page = 1) =>
      h.context.pacientes.list({ q, estado, page, page_size: 1 });
    expect(await list('%_.*')).toMatchObject({ total: 1, items: [a] });
    expect(await list('ana', 'activo', 2)).toMatchObject({
      total: 3,
      items: [{ paciente: { numero_documento: 'DOC-2' } }],
    });
    expect(await list('doc-1')).toMatchObject({ total: 1, items: [a] });
    expect(await list(a.expediente.numero_expediente)).toMatchObject({ total: 1, items: [a] });
    await h.context.pacientes.archiveExpediente({
      id_expediente: b.expediente.id_expediente,
      motivo_archivo: 'traslado',
      fecha_archivo: h.context.clock.nowIso(),
    });
    expect((await list('')).total).toBe(2);
    expect((await list('', 'todos')).total).toBe(3);
    expect((await list('', 'archivado')).total).toBe(1);
    const other = await h.otherInstitution();
    expect(
      (await other.pacientes.list({ q: '', estado: 'todos', page: 1, page_size: 10 })).total,
    ).toBe(0);
  });

  it('firestore_guardians_references_and_outer_rollback', async () => {
    const h = await boot('centro_pediatrico');
    await expect(h.context.pacientes.createWithExpediente(input('PED'))).rejects.toMatchObject({
      code: 'guardian_required',
    });
    const guardian = {
      tipo_documento: 'DPI',
      numero_documento: 'G',
      nombre_completo: 'Tutor',
      parentesco: 'madre' as const,
      telefono: '5555',
      es_principal: true,
    };
    await expect(
      h.context.pacientes.createWithExpediente({
        ...input('PED'),
        responsables: [guardian, guardian],
      }),
    ).rejects.toMatchObject({ code: 'invalid_guardians' });
    const valid = { ...input('PED'), responsables: [guardian] };
    await expect(
      h.context.pacientes.createWithExpediente({ ...valid, id_municipio: 999 }),
    ).rejects.toMatchObject({ code: 'reference_not_found' });
    const before = await h.counts();
    await expect(
      h.context.unitOfWork.runInTransaction(async () => {
        const saved = await h.context.pacientes.createWithExpediente(valid);
        expect(await h.context.pacientes.findById(saved.paciente.id_paciente)).toEqual(
          saved.paciente,
        );
        throw new Error('outer rollback');
      }),
    ).rejects.toThrow('outer rollback');
    expect(await h.counts()).toEqual(before);
    await h.context.pacientes.createWithExpediente(valid);
    expect(await h.counts()).toMatchObject({ patients: 1, records: 1, responsibles: 1 });
  });
});
