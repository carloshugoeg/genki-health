import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { CITA, CITAInput, Slot } from '@genki/shared/full/agenda';
import { ClinicalError } from '../../src/domain/clinical-error.js';
import type { FullContext, OperationContext } from '../../src/ports/full/context.js';
import type { Op20Request, Op21Request } from '../../src/ports/full/agenda.js';

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
  });
}
