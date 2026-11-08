import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { CITA, CITAInput, Slot } from '@genki/shared/full/agenda';
import { ClinicalError } from '../../src/domain/clinical-error.js';
import type { FullContext, OperationContext } from '../../src/ports/full/context.js';
import type {
  Op20Request,
  Op21Request,
  Op22Request,
  Op23Request,
  Op24Request,
  Op25Request,
} from '../../src/ports/full/agenda.js';

/** F1 FullHarness shape used by module contracts (toolchain harness not required). */
export type FullHarness = {
  context: FullContext;
  actor: OperationContext;
  reset(): Promise<void>;
  counts(): Promise<Record<string, number>>;
  nativeSnapshot(): Promise<Record<string, string>>;
  failAfterWrite(n: number): void;
  otherInstitution(): Promise<FullHarness>;
  close(): Promise<void>;
  /** Test-only: force store_unavailable on the next agenda call. */
  setStoreUnavailable(): void;
  seedPatient(doc: string): Promise<{ id_paciente: number }>;
  seedBusyCita(input: {
    id_paciente: number;
    id_profesional: number;
    fecha_hora: string;
    duracion_minutos: number;
    estado?: string;
  }): Promise<CITA>;
};

type AgendaApplication = {
  executeOp20: (
    context: FullContext,
    input: Op20Request,
    actor: OperationContext,
  ) => Promise<Slot[]>;
  executeOp21: (context: FullContext, input: Op21Request, actor: OperationContext) => Promise<CITA>;
  executeOp22: (context: FullContext, input: Op22Request, actor: OperationContext) => Promise<CITA>;
  executeOp23: (context: FullContext, input: Op23Request, actor: OperationContext) => Promise<CITA>;
  executeOp24: (context: FullContext, input: Op24Request, actor: OperationContext) => Promise<CITA>;
  executeOp25: (
    context: FullContext,
    input: Op25Request,
    actor: OperationContext,
  ) => Promise<CITA[]>;
};

async function loadApplication(): Promise<AgendaApplication> {
  return import('../../src/application/full/agenda.js') as Promise<AgendaApplication>;
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

async function expectCode(promise: Promise<unknown>, code: ClinicalError['code']): Promise<void> {
  try {
    await promise;
    expect.fail(`expected ClinicalError ${code}`);
  } catch (err) {
    expect(errorCode(err)).toBe(code);
  }
}

function emptyBody(): Record<string, never> {
  return {};
}

function emptyParams(): Record<string, never> {
  return {};
}

function emptyQuery(): Record<string, never> {
  return {};
}

/** Monday 2026-06-01 Guatemala business window expressed as UTC ISO bounds. */
export const FIXTURE = {
  now: '2026-05-29T12:00:00.000Z',
  profesional: 1,
  desde: '2026-06-01T12:00:00.000Z',
  hasta: '2026-06-02T00:00:00.000Z',
  slotStart: '2026-06-01T14:00:00.000Z',
  slotEnd: '2026-06-01T14:30:00.000Z',
  overlapStart: '2026-06-01T14:15:00.000Z',
  rescheduleStart: '2026-06-01T15:00:00.000Z',
  otherSlotStart: '2026-06-01T16:00:00.000Z',
  dayFecha: '2026-06-01',
  nextDayFecha: '2026-06-02',
  nextDaySlotStart: '2026-06-02T14:00:00.000Z',
  impossibleFecha: '2026-02-30',
} as const;

function op20Query(
  overrides: Partial<Op20Request['query']> & Record<string, unknown> = {},
): Op20Request {
  return {
    params: emptyParams(),
    query: {
      id_profesional: FIXTURE.profesional,
      desde: FIXTURE.desde,
      hasta: FIXTURE.hasta,
      ...overrides,
    } as Op20Request['query'],
    body: emptyBody(),
  };
}

function op21Body(overrides: Partial<CITAInput> & Record<string, unknown> = {}): Op21Request {
  return {
    params: emptyParams(),
    query: emptyQuery(),
    body: {
      id_paciente: 1,
      id_profesional: FIXTURE.profesional,
      fecha_hora: FIXTURE.slotStart,
      duracion_minutos: 30,
      motivo: null,
      ...overrides,
    } as CITAInput,
  };
}

function op22Input(
  id: number,
  overrides: Partial<Op22Request['body']> & Record<string, unknown> = {},
): Op22Request {
  return {
    params: { id },
    query: emptyQuery(),
    body: {
      fecha_hora: FIXTURE.rescheduleStart,
      duracion_minutos: 30,
      ...overrides,
    } as Op22Request['body'],
  };
}

function op23Input(
  id: number,
  overrides: Partial<Op23Request['body']> & Record<string, unknown> = {},
): Op23Request {
  return {
    params: { id },
    query: emptyQuery(),
    body: {
      motivo: 'Paciente solicitó cancelación',
      ...overrides,
    } as Op23Request['body'],
  };
}

function op24Input(
  id: number,
  overrides: {
    params?: Partial<Op24Request['params']> & Record<string, unknown>;
    body?: Partial<Op24Request['body']> & Record<string, unknown>;
  } = {},
): Op24Request {
  return {
    params: { id, ...(overrides.params ?? {}) } as Op24Request['params'],
    query: emptyQuery(),
    body: { ...(overrides.body ?? {}) } as Op24Request['body'],
  };
}

function op25Query(
  overrides: Partial<Op25Request['query']> & Record<string, unknown> = {},
): Op25Request {
  return {
    params: emptyParams(),
    query: {
      fecha: FIXTURE.dayFecha,
      ...overrides,
    } as Op25Request['query'],
    body: emptyBody(),
  };
}

function actorWith(base: OperationContext, patch: Partial<OperationContext>): OperationContext {
  return { ...base, ...patch };
}

function snapshotHash(rows: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

export function moduleContract(
  name: string,
  make: () => Promise<FullHarness>,
  ops: readonly number[],
): void {
  describe(`agendaContract:${name}`, () => {
    const has20 = ops.includes(20);
    const has21 = ops.includes(21);
    const has22 = ops.includes(22);
    const has23 = ops.includes(23);
    const has24 = ops.includes(24);
    const has25 = ops.includes(25);

    if (has20) {
      it('op20_transition_1_persists', async () => {
        const { executeOp20 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        const beforeCounts = await harness.counts();
        const slots = await executeOp20(harness.context, op20Query(), harness.actor);
        expect(Array.isArray(slots)).toBe(true);
        expect(slots.length).toBeGreaterThan(0);
        const first = slots[0] as Slot;
        expect(first.id_profesional).toBe(FIXTURE.profesional);
        expect(first.inicio).toBe(FIXTURE.slotStart);
        expect(first.fin).toBe(FIXTURE.slotEnd);
        expect(await harness.nativeSnapshot()).toEqual(before);
        expect(await harness.counts()).toEqual(beforeCounts);
        await harness.close();
      });

      it('op20_error_domain_unchanged', async () => {
        const { executeOp20 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp20(
            harness.context,
            op20Query({
              desde: FIXTURE.desde,
              hasta: '2026-07-15T00:00:00.000Z',
            }),
            harness.actor,
          ),
          'invalid_query',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op20_error_schema_unchanged', async () => {
        const { executeOp20 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp20(harness.context, op20Query({ extra: 'nope' }), harness.actor),
          'invalid_query',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op20_error_role_unchanged', async () => {
        const { executeOp20 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        const forbidden = actorWith(harness.actor, { roles: ['administrador'] });
        await expectCode(executeOp20(harness.context, op20Query(), forbidden), 'forbidden');
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op20_error_foreign_unchanged', async () => {
        const { executeOp20 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp20(harness.context, op20Query({ id_profesional: 404404 }), harness.actor),
          'not_found',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op20_error_store_unchanged', async () => {
        const { executeOp20 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        harness.setStoreUnavailable();
        await expectCode(
          executeOp20(harness.context, op20Query(), harness.actor),
          'store_unavailable',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });
    }

    if (has21) {
      it('op21_transition_1_persists', async () => {
        const { executeOp21 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-OK-1');
        const beforeCounts = await harness.counts();
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        expect(created.id_cita).toBeGreaterThan(0);
        expect(created.id_paciente).toBe(patient.id_paciente);
        expect(created.id_profesional).toBe(FIXTURE.profesional);
        expect(created.fecha_hora).toBe(FIXTURE.slotStart);
        expect(created.duracion_minutos).toBe(30);
        expect(created.estado).toBe('programada');
        expect(created.id_usuario_registra).toBe(harness.actor.id_usuario);
        const afterCounts = await harness.counts();
        expect(afterCounts.citas).toBe((beforeCounts.citas ?? 0) + 1);
        const snap = await harness.nativeSnapshot();
        expect(snap.citas).toBe(
          snapshotHash([
            {
              id_cita: created.id_cita,
              id_profesional: created.id_profesional,
              fecha_hora: created.fecha_hora,
              duracion_minutos: created.duracion_minutos,
              estado: created.estado,
            },
          ]),
        );
        await harness.close();
      });

      it('op21_error_domain_unchanged', async () => {
        const { executeOp21 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-CONFLICT-1');
        await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp21(
            harness.context,
            op21Body({
              id_paciente: patient.id_paciente,
              fecha_hora: FIXTURE.overlapStart,
              duracion_minutos: 30,
            }),
            harness.actor,
          ),
          'conflict',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op21_error_schema_unchanged', async () => {
        const { executeOp21 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp21(harness.context, op21Body({ mystery: true }), harness.actor),
          'invalid_body',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op21_error_role_unchanged', async () => {
        const { executeOp21 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-ROLE-1');
        const before = await harness.nativeSnapshot();
        const forbidden = actorWith(harness.actor, { roles: ['medico'] });
        await expectCode(
          executeOp21(harness.context, op21Body({ id_paciente: patient.id_paciente }), forbidden),
          'forbidden',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op21_error_foreign_unchanged', async () => {
        const { executeOp21 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp21(harness.context, op21Body({ id_paciente: 909090 }), harness.actor),
          'not_found',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op21_error_store_unchanged', async () => {
        const { executeOp21 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-STORE-1');
        const before = await harness.nativeSnapshot();
        harness.setStoreUnavailable();
        await expectCode(
          executeOp21(
            harness.context,
            op21Body({ id_paciente: patient.id_paciente }),
            harness.actor,
          ),
          'store_unavailable',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op21_midwrite_rolls_back', async () => {
        const { executeOp21 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-MID-1');
        const before = await harness.nativeSnapshot();
        const beforeCounts = await harness.counts();
        harness.failAfterWrite(1);
        await expectCode(
          executeOp21(
            harness.context,
            op21Body({ id_paciente: patient.id_paciente }),
            harness.actor,
          ),
          'internal_error',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        expect(await harness.counts()).toEqual(beforeCounts);
        await harness.close();
      });
    }

    if (has22) {
      it('op22_transition_1_persists', async () => {
        const { executeOp21, executeOp22 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-R22-1');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        expect(created.estado).toBe('programada');
        const moved = await executeOp22(harness.context, op22Input(created.id_cita), harness.actor);
        expect(moved.id_cita).toBe(created.id_cita);
        expect(moved.fecha_hora).toBe(FIXTURE.rescheduleStart);
        expect(moved.duracion_minutos).toBe(30);
        expect(moved.estado).toBe('programada');
        expect(moved.id_paciente).toBe(patient.id_paciente);
        const snap = await harness.nativeSnapshot();
        expect(snap.citas).toBe(
          snapshotHash([
            {
              id_cita: moved.id_cita,
              id_profesional: moved.id_profesional,
              fecha_hora: moved.fecha_hora,
              duracion_minutos: moved.duracion_minutos,
              estado: moved.estado,
            },
          ]),
        );
        await harness.close();
      });

      it('op22_transition_2_persists', async () => {
        const { executeOp22 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-R22-2');
        const seeded = await harness.seedBusyCita({
          id_paciente: patient.id_paciente,
          id_profesional: FIXTURE.profesional,
          fecha_hora: FIXTURE.slotStart,
          duracion_minutos: 30,
          estado: 'confirmada',
        });
        const moved = await executeOp22(harness.context, op22Input(seeded.id_cita), harness.actor);
        expect(moved.id_cita).toBe(seeded.id_cita);
        expect(moved.fecha_hora).toBe(FIXTURE.rescheduleStart);
        expect(moved.estado).toBe('programada');
        await harness.close();
      });

      it('op22_error_domain_unchanged', async () => {
        const { executeOp21, executeOp22 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-R22-DOM');
        const first = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        await executeOp21(
          harness.context,
          op21Body({
            id_paciente: patient.id_paciente,
            fecha_hora: FIXTURE.otherSlotStart,
          }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp22(
            harness.context,
            op22Input(first.id_cita, {
              fecha_hora: FIXTURE.otherSlotStart,
              duracion_minutos: 30,
            }),
            harness.actor,
          ),
          'conflict',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op22_error_schema_unchanged', async () => {
        const { executeOp21, executeOp22 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-R22-SCH');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp22(
            harness.context,
            op22Input(created.id_cita, { mystery: true }),
            harness.actor,
          ),
          'invalid_body',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op22_error_store_unchanged', async () => {
        const { executeOp21, executeOp22 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-R22-ST');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        harness.setStoreUnavailable();
        await expectCode(
          executeOp22(harness.context, op22Input(created.id_cita), harness.actor),
          'store_unavailable',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op22_error_role_unchanged', async () => {
        const { executeOp21, executeOp22 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-R22-ROLE');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        const forbidden = actorWith(harness.actor, { roles: ['medico'] });
        await expectCode(
          executeOp22(harness.context, op22Input(created.id_cita), forbidden),
          'forbidden',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op22_error_foreign_unchanged', async () => {
        const { executeOp22 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp22(harness.context, op22Input(909090), harness.actor),
          'not_found',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op22_midwrite_rolls_back', async () => {
        const { executeOp21, executeOp22 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-R22-MID');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        const beforeCounts = await harness.counts();
        harness.failAfterWrite(1);
        await expectCode(
          executeOp22(harness.context, op22Input(created.id_cita), harness.actor),
          'internal_error',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        expect(await harness.counts()).toEqual(beforeCounts);
        await harness.close();
      });
    }

    if (has23) {
      it('op23_transition_1_persists', async () => {
        const { executeOp21, executeOp23 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-C23-1');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        expect(created.estado).toBe('programada');
        const cancelled = await executeOp23(
          harness.context,
          op23Input(created.id_cita),
          harness.actor,
        );
        expect(cancelled.id_cita).toBe(created.id_cita);
        expect(cancelled.estado).toBe('cancelada');
        expect(cancelled.fecha_hora).toBe(created.fecha_hora);
        expect(cancelled.duracion_minutos).toBe(created.duracion_minutos);
        const afterCounts = await harness.counts();
        expect(afterCounts.citas).toBe(1);
        const snap = await harness.nativeSnapshot();
        expect(snap.citas).toBe(
          snapshotHash([
            {
              id_cita: cancelled.id_cita,
              id_profesional: cancelled.id_profesional,
              fecha_hora: cancelled.fecha_hora,
              duracion_minutos: cancelled.duracion_minutos,
              estado: 'cancelada',
            },
          ]),
        );
        await harness.close();
      });

      it('op23_transition_2_persists', async () => {
        const { executeOp23 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-C23-2');
        const seeded = await harness.seedBusyCita({
          id_paciente: patient.id_paciente,
          id_profesional: FIXTURE.profesional,
          fecha_hora: FIXTURE.slotStart,
          duracion_minutos: 30,
          estado: 'confirmada',
        });
        const cancelled = await executeOp23(
          harness.context,
          op23Input(seeded.id_cita),
          harness.actor,
        );
        expect(cancelled.id_cita).toBe(seeded.id_cita);
        expect(cancelled.estado).toBe('cancelada');
        await harness.close();
      });

      it('op23_error_domain_unchanged', async () => {
        const { executeOp23 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-C23-DOM');
        const seeded = await harness.seedBusyCita({
          id_paciente: patient.id_paciente,
          id_profesional: FIXTURE.profesional,
          fecha_hora: FIXTURE.slotStart,
          duracion_minutos: 30,
          estado: 'cancelada',
        });
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp23(harness.context, op23Input(seeded.id_cita), harness.actor),
          'conflict',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op23_error_schema_unchanged', async () => {
        const { executeOp21, executeOp23 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-C23-SCH');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp23(
            harness.context,
            op23Input(created.id_cita, { mystery: true }),
            harness.actor,
          ),
          'invalid_body',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op23_error_store_unchanged', async () => {
        const { executeOp21, executeOp23 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-C23-ST');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        harness.setStoreUnavailable();
        await expectCode(
          executeOp23(harness.context, op23Input(created.id_cita), harness.actor),
          'store_unavailable',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op23_error_role_unchanged', async () => {
        const { executeOp21, executeOp23 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-C23-ROLE');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        const forbidden = actorWith(harness.actor, { roles: ['medico'] });
        await expectCode(
          executeOp23(harness.context, op23Input(created.id_cita), forbidden),
          'forbidden',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op23_error_foreign_unchanged', async () => {
        const { executeOp23 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp23(harness.context, op23Input(909090), harness.actor),
          'not_found',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op23_midwrite_rolls_back', async () => {
        const { executeOp21, executeOp23 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-C23-MID');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        const beforeCounts = await harness.counts();
        harness.failAfterWrite(1);
        await expectCode(
          executeOp23(harness.context, op23Input(created.id_cita), harness.actor),
          'internal_error',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        expect(await harness.counts()).toEqual(beforeCounts);
        await harness.close();
      });
    }

    if (has24) {
      it('op24_transition_1_persists', async () => {
        const { executeOp21, executeOp24 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-A24-1');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        expect(created.estado).toBe('programada');
        const arrived = await executeOp24(
          harness.context,
          op24Input(created.id_cita),
          harness.actor,
        );
        expect(arrived.id_cita).toBe(created.id_cita);
        expect(arrived.estado).toBe('confirmada');
        expect(arrived.fecha_hora).toBe(created.fecha_hora);
        const again = await executeOp24(harness.context, op24Input(created.id_cita), harness.actor);
        expect(again.estado).toBe('confirmada');
        const snap = await harness.nativeSnapshot();
        expect(snap.citas).toBe(
          snapshotHash([
            {
              id_cita: arrived.id_cita,
              id_profesional: arrived.id_profesional,
              fecha_hora: arrived.fecha_hora,
              duracion_minutos: arrived.duracion_minutos,
              estado: 'confirmada',
            },
          ]),
        );
        await harness.close();
      });

      it('op24_error_domain_unchanged', async () => {
        const { executeOp24 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-A24-DOM');
        const seeded = await harness.seedBusyCita({
          id_paciente: patient.id_paciente,
          id_profesional: FIXTURE.profesional,
          fecha_hora: FIXTURE.slotStart,
          duracion_minutos: 30,
          estado: 'cancelada',
        });
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp24(harness.context, op24Input(seeded.id_cita), harness.actor),
          'conflict',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op24_error_schema_unchanged', async () => {
        const { executeOp21, executeOp24 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-A24-SCH');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp24(
            harness.context,
            op24Input(created.id_cita, { body: { mystery: true } }),
            harness.actor,
          ),
          'invalid_body',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op24_error_store_unchanged', async () => {
        const { executeOp21, executeOp24 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-A24-ST');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        harness.setStoreUnavailable();
        await expectCode(
          executeOp24(harness.context, op24Input(created.id_cita), harness.actor),
          'store_unavailable',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op24_error_role_unchanged', async () => {
        const { executeOp21, executeOp24 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-A24-ROLE');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        const forbidden = actorWith(harness.actor, { roles: ['medico'] });
        await expectCode(
          executeOp24(harness.context, op24Input(created.id_cita), forbidden),
          'forbidden',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op24_error_foreign_unchanged', async () => {
        const { executeOp24 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp24(harness.context, op24Input(909090), harness.actor),
          'not_found',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op24_midwrite_rolls_back', async () => {
        const { executeOp21, executeOp24 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-A24-MID');
        const created = await executeOp21(
          harness.context,
          op21Body({ id_paciente: patient.id_paciente }),
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        const beforeCounts = await harness.counts();
        harness.failAfterWrite(1);
        await expectCode(
          executeOp24(harness.context, op24Input(created.id_cita), harness.actor),
          'internal_error',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        expect(await harness.counts()).toEqual(beforeCounts);
        await harness.close();
      });
    }

    if (has25) {
      it('op25_transition_1_persists', async () => {
        const { executeOp21, executeOp25 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const patient = await harness.seedPatient('AGENDA-D25-1');
        const created = await executeOp21(
          harness.context,
          op21Body({
            id_paciente: patient.id_paciente,
            motivo: 'Dolor de cabeza',
          }),
          harness.actor,
        );
        await harness.seedBusyCita({
          id_paciente: patient.id_paciente,
          id_profesional: FIXTURE.profesional,
          fecha_hora: FIXTURE.nextDaySlotStart,
          duracion_minutos: 30,
          estado: 'programada',
        });
        const beforeCounts = await harness.counts();
        const rows = await executeOp25(harness.context, op25Query(), harness.actor);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.id_cita).toBe(created.id_cita);
        expect(rows[0]?.fecha_hora).toBe(FIXTURE.slotStart);
        expect(rows[0]?.motivo).toBeNull();
        expect(await harness.counts()).toEqual(beforeCounts);
        const filtered = await executeOp25(
          harness.context,
          op25Query({ id_profesional: FIXTURE.profesional }),
          harness.actor,
        );
        expect(filtered).toHaveLength(1);
        expect(filtered[0]?.id_cita).toBe(created.id_cita);
        await harness.close();
      });

      it('op25_error_domain_unchanged', async () => {
        const { executeOp25 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp25(
            harness.context,
            op25Query({ fecha: FIXTURE.impossibleFecha }),
            harness.actor,
          ),
          'invalid_query',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op25_error_schema_unchanged', async () => {
        const { executeOp25 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp25(harness.context, op25Query({ mystery: true }), harness.actor),
          'invalid_query',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op25_error_store_unchanged', async () => {
        const { executeOp25 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        harness.setStoreUnavailable();
        await expectCode(
          executeOp25(harness.context, op25Query(), harness.actor),
          'store_unavailable',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op25_error_role_unchanged', async () => {
        const { executeOp25 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        const forbidden = actorWith(harness.actor, { roles: ['administrador'] });
        await expectCode(executeOp25(harness.context, op25Query(), forbidden), 'forbidden');
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op25_error_foreign_unchanged', async () => {
        const { executeOp25 } = await loadApplication();
        const harness = await make();
        await harness.reset();
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp25(harness.context, op25Query({ id_profesional: 404404 }), harness.actor),
          'not_found',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });
    }
  });
}
