import { describe, expect, it } from 'vitest';
import type { PacienteId } from '@genki/shared';
import { ClinicalError } from '../../src/domain/clinical-error.js';
import {
  baseRegisterInput,
  closeBodyFor,
  defaultKind,
  pediatricKind,
  pediatricRegisterInput,
  threeSearchPatients,
} from './fixtures.js';
import {
  assertCountsEqual,
  type ClinicalHarness,
  type ClinicalHarnessFactory,
  type CountSnapshot,
} from './harness.js';

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

export function clinicalContract(name: string, make: ClinicalHarnessFactory): void {
  describe(`clinicalContract:${name}`, () => {
    let harness: ClinicalHarness;

    async function boot(kind = defaultKind()): Promise<ClinicalHarness> {
      const next = await make({ kind });
      await next.reset();
      return next;
    }

    it('register_creates_patient_and_one_active_expediente', async () => {
      harness = await boot();
      const before = await harness.counts();
      const resumen = await harness.context.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: 'REG-001' }),
      );
      expect(resumen.paciente.id_paciente).toBeGreaterThan(0);
      expect(resumen.expediente.id_expediente).toBeGreaterThan(0);
      expect(resumen.expediente.numero_expediente).toMatch(/^EXP-/);
      expect(resumen.expediente.estado).toBe('activo');
      expect(resumen.expediente.fecha_archivo).toBeNull();
      expect(resumen.expediente.motivo_archivo).toBeNull();
      const after = await harness.counts();
      expect(after.pacientes).toBe(before.pacientes + 1);
      expect(after.expedientes).toBe(before.expedientes + 1);
      await harness.close();
    });

    it('duplicate_document_rolls_back_second_registration', async () => {
      harness = await boot();
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
      await harness.close();
    });

    it('concurrent_duplicate_has_exactly_one_winner', async () => {
      harness = await boot();
      const input = baseRegisterInput({ numero_documento: 'RACE-001' });
      const results = await Promise.allSettled([
        harness.context.pacientes.createWithExpediente(input),
        harness.context.pacientes.createWithExpediente({ ...input, primer_nombre: 'Clone' }),
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

    it('pediatric_requires_exactly_one_principal', async () => {
      harness = await boot(pediatricKind());
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
      const ok = await harness.context.pacientes.createWithExpediente(
        pediatricRegisterInput('valid_pair'),
      );
      expect(ok.expediente.estado).toBe('activo');
      const after = await harness.counts();
      expect(after.pacientes).toBe(1);
      expect(after.expedientes).toBe(1);
      expect(after.responsables).toBe(2);
      await harness.close();
    });

    it('search_document_record_name_and_pagination', async () => {
      harness = await boot();
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
      await harness.close();
    });

    it('foreign_institution_id_is_invisible', async () => {
      harness = await boot();
      const local = await harness.context.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: 'LOCAL-001' }),
      );
      const other = await harness.otherInstitution();
      const foreign = await other.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: 'FOREIGN-001' }),
      );

      expect(await harness.context.pacientes.findById(foreign.paciente.id_paciente)).toBeNull();
      const listed = await harness.context.pacientes.list({
        q: 'FOREIGN-001',
        estado: 'todos',
        page: 1,
        page_size: 10,
      });
      expect(listed.total).toBe(0);

      await expectClinicalCode(
        harness.context.pacientes.archiveExpediente({
          id_expediente: foreign.expediente.id_expediente,
          motivo_archivo: 'administrativo',
          fecha_archivo: harness.context.clock.nowIso(),
        }),
        'not_found',
      );

      const closeBody = await closeBodyFor(harness.context, { withReceta: false });
      await expectClinicalCode(
        harness.context.consultas.closeConsulta({
          id_paciente: foreign.paciente.id_paciente,
          body: closeBody,
        }),
        'not_found',
      );

      expect(await other.pacientes.findById(local.paciente.id_paciente)).toBeNull();
      await harness.close();
    });

    it('register_failure_after_patient_rolls_back_every_row', async () => {
      harness = await boot(pediatricKind());
      const before = await harness.counts();
      harness.failNext('afterPaciente');
      await expect(
        harness.context.pacientes.createWithExpediente(pediatricRegisterInput('valid_pair')),
      ).rejects.toBeTruthy();
      assertCountsEqual(await harness.counts(), before);
      await harness.close();
    });

    it('close_persists_complete_bundle', async () => {
      harness = await boot();
      const patient = await harness.context.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: 'CLOSE-001' }),
      );
      const before = await harness.counts();
      const body = await closeBodyFor(harness.context, { withReceta: true });
      const completa = await harness.context.consultas.closeConsulta({
        id_paciente: patient.paciente.id_paciente,
        body,
      });
      expect(completa.consulta.estado).toBe('cerrada');
      expect(completa.consulta.id_cita).toBeNull();
      expect(completa.diagnosticos).toHaveLength(2);
      expect(completa.tratamientos).toHaveLength(2);
      expect(completa.receta).not.toBeNull();
      expect(completa.detalles).toHaveLength(2);
      expect(completa.receta?.id_profesional).toBe(completa.consulta.id_profesional);
      const after = await harness.counts();
      expect(after.consultas).toBe(before.consultas + 1);
      expect(after.diagnosticos).toBe(before.diagnosticos + 2);
      expect(after.tratamientos).toBe(before.tratamientos + 2);
      expect(after.recetas).toBe(before.recetas + 1);
      expect(after.detalles).toBe(before.detalles + 2);
      const history = await harness.context.consultas.listByExpediente(
        patient.expediente.id_expediente,
      );
      expect(history).toHaveLength(1);
      expect(history[0]?.detalles).toHaveLength(2);
      await harness.close();
    });

    it('close_without_recipe_is_atomic', async () => {
      harness = await boot();
      const patient = await harness.context.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: 'CLOSE-002' }),
      );
      const before = await harness.counts();
      const body = await closeBodyFor(harness.context, { withReceta: false });
      const completa = await harness.context.consultas.closeConsulta({
        id_paciente: patient.paciente.id_paciente,
        body,
      });
      expect(completa.receta).toBeNull();
      expect(completa.detalles).toEqual([]);
      expect(completa.diagnosticos).toHaveLength(2);
      expect(completa.tratamientos).toHaveLength(2);
      const after = await harness.counts();
      expect(after.consultas).toBe(before.consultas + 1);
      expect(after.recetas).toBe(before.recetas);
      expect(after.detalles).toBe(before.detalles);
      await harness.close();
    });

    it('close_failure_after_diagnosis_rolls_back_every_child', async () => {
      harness = await boot();
      const patient = await harness.context.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: 'CLOSE-003' }),
      );
      const before = await harness.counts();
      harness.failNext('afterDiagnostico');
      const body = await closeBodyFor(harness.context, { withReceta: true });
      await expect(
        harness.context.consultas.closeConsulta({
          id_paciente: patient.paciente.id_paciente,
          body,
        }),
      ).rejects.toBeTruthy();
      assertCountsEqual(await harness.counts(), before);
      const history = await harness.context.consultas.listByExpediente(
        patient.expediente.id_expediente,
      );
      expect(history).toEqual([]);
      await harness.close();
    });

    it('late_invalid_medication_rolls_back_bundle', async () => {
      harness = await boot();
      const patient = await harness.context.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: 'CLOSE-004' }),
      );
      const before = await harness.counts();
      const body = await closeBodyFor(harness.context, {
        withReceta: true,
        invalidSecondMedication: true,
      });
      await expectClinicalCode(
        harness.context.consultas.closeConsulta({
          id_paciente: patient.paciente.id_paciente,
          body,
        }),
        'reference_not_found',
      );
      assertCountsEqual(await harness.counts(), before);
      await harness.close();
    });

    it('archive_preserves_history_and_patient_state', async () => {
      harness = await boot();
      const patient = await harness.context.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: 'ARCH-001' }),
      );
      const body = await closeBodyFor(harness.context, { withReceta: false });
      await harness.context.consultas.closeConsulta({
        id_paciente: patient.paciente.id_paciente,
        body,
      });
      const archived = await harness.context.pacientes.archiveExpediente({
        id_expediente: patient.expediente.id_expediente,
        motivo_archivo: 'administrativo',
        fecha_archivo: harness.context.clock.nowIso(),
        observacion_archivo: 'demo',
      });
      expect(archived.estado).toBe('archivado');
      const refreshed = await harness.context.pacientes.findById(patient.paciente.id_paciente);
      expect(refreshed?.estado).toBe('activo');
      const history = await harness.context.consultas.listByExpediente(
        patient.expediente.id_expediente,
      );
      expect(history).toHaveLength(1);
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

    it('archive_twice_is_rejected', async () => {
      harness = await boot();
      const patient = await harness.context.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: 'ARCH-002' }),
      );
      const first = await harness.context.pacientes.archiveExpediente({
        id_expediente: patient.expediente.id_expediente,
        motivo_archivo: 'traslado',
        fecha_archivo: '2026-11-01T00:00:00.000Z',
        observacion_archivo: 'first',
      });
      await expectClinicalCode(
        harness.context.pacientes.archiveExpediente({
          id_expediente: patient.expediente.id_expediente,
          motivo_archivo: 'administrativo',
          fecha_archivo: harness.context.clock.nowIso(),
        }),
        'already_archived',
      );
      const again = await harness.context.pacientes.findExpedienteById(
        patient.expediente.id_expediente,
      );
      expect(again?.motivo_archivo).toBe(first.motivo_archivo);
      expect(again?.fecha_archivo).toBe(first.fecha_archivo);
      await harness.close();
    });

    it('close_archived_is_rejected', async () => {
      harness = await boot();
      const patient = await harness.context.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: 'ARCH-003' }),
      );
      await harness.context.pacientes.archiveExpediente({
        id_expediente: patient.expediente.id_expediente,
        motivo_archivo: 'inactividad',
        fecha_archivo: harness.context.clock.nowIso(),
      });
      const before = await harness.counts();
      const body = await closeBodyFor(harness.context, { withReceta: false });
      await expectClinicalCode(
        harness.context.consultas.closeConsulta({
          id_paciente: patient.paciente.id_paciente,
          body,
        }),
        'expediente_archived',
      );
      assertCountsEqual(await harness.counts(), before);
      await harness.close();
    });

    it('archive_close_race_serializes', async () => {
      harness = await boot();
      const patient = await harness.context.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: 'RACE-AC-001' }),
      );
      const body = await closeBodyFor(harness.context, { withReceta: true });
      const results = await Promise.allSettled([
        harness.context.consultas.closeConsulta({
          id_paciente: patient.paciente.id_paciente,
          body,
        }),
        harness.context.pacientes.archiveExpediente({
          id_expediente: patient.expediente.id_expediente,
          motivo_archivo: 'administrativo',
          fecha_archivo: harness.context.clock.nowIso(),
        }),
      ]);
      const archiveResult = results[1];
      expect(archiveResult.status).toBe('fulfilled');
      const closeResult = results[0];
      const expediente = await harness.context.pacientes.findExpedienteById(
        patient.expediente.id_expediente,
      );
      expect(expediente?.estado).toBe('archivado');
      const history = await harness.context.consultas.listByExpediente(
        patient.expediente.id_expediente,
      );
      if (closeResult.status === 'fulfilled') {
        expect(history).toHaveLength(1);
        expect(history[0]?.diagnosticos.length).toBe(2);
        expect(history[0]?.detalles.length).toBe(2);
      } else {
        expect(errorCode(closeResult.reason)).toBe('expediente_archived');
        expect(history).toEqual([]);
      }
      const counts = await harness.counts();
      if (closeResult.status === 'fulfilled') {
        expect(counts.consultas).toBe(1);
        expect(counts.diagnosticos).toBe(2);
        expect(counts.tratamientos).toBe(2);
        expect(counts.recetas).toBe(1);
        expect(counts.detalles).toBe(2);
      } else {
        expect(counts.consultas).toBe(0);
        expect(counts.diagnosticos).toBe(0);
        expect(counts.tratamientos).toBe(0);
        expect(counts.recetas).toBe(0);
        expect(counts.detalles).toBe(0);
      }
      await harness.close();
    });

    it('uow_outer_failure_rolls_back_nested_success', async () => {
      harness = await boot();
      const before = await harness.counts();
      await expect(
        harness.context.unitOfWork.runInTransaction(async () => {
          const patient = await harness.context.pacientes.createWithExpediente(
            baseRegisterInput({ numero_documento: 'UOW-001' }),
          );
          const body = await closeBodyFor(harness.context, { withReceta: false });
          await harness.context.consultas.closeConsulta({
            id_paciente: patient.paciente.id_paciente,
            body,
          });
          throw new Error('outer failure');
        }),
      ).rejects.toThrow(/outer failure/);
      assertCountsEqual(await harness.counts(), before);
      await harness.close();
    });

    it('returned_dto_mutation_does_not_change_storage', async () => {
      harness = await boot();
      const resumen = await harness.context.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: 'MUT-001', primer_nombre: 'Original' }),
      );
      const mutableName = resumen.paciente.primer_nombre;
      (resumen.paciente as { primer_nombre: string }).primer_nombre = 'Mutated';
      expect(mutableName).toBe('Original');
      const refetched = await harness.context.pacientes.findById(
        resumen.paciente.id_paciente as PacienteId,
      );
      expect(refetched?.primer_nombre).toBe('Original');
      await harness.close();
    });
  });
}

export type { CountSnapshot };
