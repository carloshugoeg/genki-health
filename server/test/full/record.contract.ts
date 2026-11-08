import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ANTECEDENTEInput } from '@genki/shared/full/record';
import { ClinicalError } from '../../src/domain/clinical-error.js';
import type { FullContext, OperationContext } from '../../src/ports/full/context.js';
import type { Op12Request, Op15Request } from '../../src/ports/full/record.js';

export type FullHarness = {
  context: FullContext;
  actor: OperationContext;
  reset(): Promise<void>;
  counts(): Promise<Record<string, number>>;
  nativeSnapshot(): Promise<Record<string, string>>;
  failAfterWrite(n: number): void;
  setStoreUnavailable(flag: boolean): void;
  withActor(actor: OperationContext): FullHarness;
  seedActivePatient(doc: string): Promise<{ id_paciente: number; id_expediente: number }>;
  seedArchivedPatient(doc: string): Promise<{ id_paciente: number; id_expediente: number }>;
  otherInstitution(): Promise<FullHarness>;
  close(): Promise<void>;
};

export type FullHarnessFactory = () => Promise<FullHarness>;

type RecordApplication = {
  executeOp12: (
    context: FullContext,
    input: Op12Request,
    actor: OperationContext,
  ) => Promise<unknown>;
  executeOp15: (
    context: FullContext,
    input: Op15Request,
    actor: OperationContext,
  ) => Promise<unknown>;
};

async function loadRecordApplication(): Promise<RecordApplication> {
  const mod = (await import('../../src/application/full/record.js')) as Partial<RecordApplication>;
  if (typeof mod.executeOp12 !== 'function' || typeof mod.executeOp15 !== 'function') {
    throw new ClinicalError('internal_error', 'record application exports missing');
  }
  return { executeOp12: mod.executeOp12, executeOp15: mod.executeOp15 };
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

function clinicalActor(base: OperationContext): OperationContext {
  return {
    ...base,
    roles: ['medico'],
    permissions: ['ficha.leer', 'antecedente.escribir'],
    id_profesional: base.id_profesional ?? 1,
  };
}

function forbiddenActor(base: OperationContext): OperationContext {
  return {
    ...base,
    roles: ['administrador'],
    permissions: [],
    id_profesional: null,
  };
}

function receptionActor(base: OperationContext): OperationContext {
  return {
    ...base,
    roles: ['recepcion'],
    permissions: ['paciente.leer'],
    id_profesional: null,
  };
}

function validAntecedente(overrides: Partial<ANTECEDENTEInput> = {}): ANTECEDENTEInput {
  return {
    tipo: overrides.tipo ?? 'personal',
    descripcion: overrides.descripcion ?? 'Asma infantil controlada',
    fecha_inicio: overrides.fecha_inicio === undefined ? '2010-05-01' : overrides.fecha_inicio,
    vigente: overrides.vigente ?? true,
  };
}

function op12(id: number, query: Record<string, unknown> = {}): Op12Request {
  return {
    params: { id },
    query: query as Op12Request['query'],
    body: {},
  };
}

function op15(id: number, body: ANTECEDENTEInput | Record<string, unknown>): Op15Request {
  return {
    params: { id },
    query: {},
    body: body as Op15Request['body'],
  };
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function recordContract(
  name: string,
  make: FullHarnessFactory,
  ops: readonly number[],
): void {
  describe(`recordContract:${name}`, () => {
    const want12 = ops.includes(12);
    const want15 = ops.includes(15);

    if (want12) {
      it('op12_transition_1_persists', async () => {
        const { executeOp12, executeOp15 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        const actor = clinicalActor(harness.actor);
        const seeded = await harness.seedActivePatient('FICHA-ACTIVE-1');
        await executeOp15(
          harness.context,
          op15(seeded.id_paciente, validAntecedente({ descripcion: 'Alergia estacional previa' })),
          { ...actor, idempotency_key: 'seed-ant-1' },
        );
        const before = await harness.nativeSnapshot();
        const ficha = (await executeOp12(
          harness.context,
          op12(seeded.id_paciente),
          actor,
        )) as {
          paciente: { id_paciente: number };
          expediente: { id_expediente: number; estado: string };
          antecedentes: unknown[];
          alergias: unknown[];
          contactos: unknown[];
        };
        expect(ficha.paciente.id_paciente).toBe(seeded.id_paciente);
        expect(ficha.expediente.id_expediente).toBe(seeded.id_expediente);
        expect(ficha.expediente.estado).toBe('activo');
        expect(ficha.antecedentes.length).toBeGreaterThanOrEqual(1);
        expect(ficha.alergias).toEqual([]);
        expect(Array.isArray(ficha.contactos)).toBe(true);
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op12_transition_2_persists', async () => {
        const { executeOp12 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        const actor = clinicalActor(harness.actor);
        const seeded = await harness.seedArchivedPatient('FICHA-ARCH-1');
        const before = await harness.nativeSnapshot();
        const ficha = (await executeOp12(
          harness.context,
          op12(seeded.id_paciente),
          actor,
        )) as {
          paciente: { id_paciente: number };
          expediente: { estado: string };
        };
        expect(ficha.expediente.estado).toBe('archivado');
        expect(ficha.paciente.id_paciente).toBe(seeded.id_paciente);
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op12_error_domain_unchanged', async () => {
        const { executeOp12 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        await harness.seedActivePatient('FICHA-DOM-1');
        const before = await harness.nativeSnapshot();
        const beforeCounts = await harness.counts();
        await expectCode(
          executeOp12(harness.context, op12(9_999_001), clinicalActor(harness.actor)),
          'not_found',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        expect(await harness.counts()).toEqual(beforeCounts);
        await harness.close();
      });

      it('op12_error_schema_unchanged', async () => {
        const { executeOp12 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedActivePatient('FICHA-SCH-1');
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp12(
            harness.context,
            op12(seeded.id_paciente, { unexpected: 'x' }),
            clinicalActor(harness.actor),
          ),
          'invalid_query',
        );
        await expectCode(
          executeOp12(harness.context, op12(0), clinicalActor(harness.actor)),
          'invalid_query',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op12_error_store_unchanged', async () => {
        const { executeOp12 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedActivePatient('FICHA-STORE-1');
        const before = await harness.nativeSnapshot();
        harness.setStoreUnavailable(true);
        await expectCode(
          executeOp12(harness.context, op12(seeded.id_paciente), clinicalActor(harness.actor)),
          'store_unavailable',
        );
        harness.setStoreUnavailable(false);
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op12_error_role_unchanged', async () => {
        const { executeOp12 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedActivePatient('FICHA-ROLE-1');
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp12(harness.context, op12(seeded.id_paciente), forbiddenActor(harness.actor)),
          'forbidden',
        );
        await expectCode(
          executeOp12(harness.context, op12(seeded.id_paciente), receptionActor(harness.actor)),
          'forbidden',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op12_error_foreign_unchanged', async () => {
        const { executeOp12 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        await harness.seedActivePatient('FICHA-HOME-1');
        const other = await harness.otherInstitution();
        await other.reset();
        const foreign = await other.seedActivePatient('FICHA-FOREIGN-1');
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp12(harness.context, op12(foreign.id_paciente), clinicalActor(harness.actor)),
          'not_found',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await other.close();
        await harness.close();
      });
    }

    if (want15) {
      it('op15_transition_1_persists', async () => {
        const { executeOp12, executeOp15 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        const actor = {
          ...clinicalActor(harness.actor),
          idempotency_key: 'ant-create-1',
        };
        const seeded = await harness.seedActivePatient('ANT-ACTIVE-1');
        const beforeCounts = await harness.counts();
        const created = (await executeOp15(
          harness.context,
          op15(seeded.id_paciente, validAntecedente()),
          actor,
        )) as {
          id_antecedente: number;
          id_expediente: number;
          tipo: string;
          descripcion: string;
          vigente: boolean;
          fecha_registro: string;
        };
        expect(created.id_antecedente).toBeGreaterThan(0);
        expect(created.id_expediente).toBe(seeded.id_expediente);
        expect(created.tipo).toBe('personal');
        expect(created.descripcion).toBe('Asma infantil controlada');
        expect(created.vigente).toBe(true);
        expect(created.fecha_registro.length).toBeGreaterThan(0);
        const afterCounts = await harness.counts();
        expect(afterCounts.antecedentes).toBe((beforeCounts.antecedentes ?? 0) + 1);
        const ficha = (await executeOp12(
          harness.context,
          op12(seeded.id_paciente),
          clinicalActor(harness.actor),
        )) as { antecedentes: Array<{ id_antecedente: number }> };
        expect(ficha.antecedentes.some((row) => row.id_antecedente === created.id_antecedente)).toBe(
          true,
        );
        const replay = await executeOp15(
          harness.context,
          op15(seeded.id_paciente, validAntecedente()),
          actor,
        );
        expect(replay).toEqual(created);
        expect((await harness.counts()).antecedentes).toBe(afterCounts.antecedentes);
        await harness.close();
      });

      it('op15_error_domain_unchanged', async () => {
        const { executeOp15 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedArchivedPatient('ANT-ARCH-1');
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp15(
            harness.context,
            op15(seeded.id_paciente, validAntecedente()),
            { ...clinicalActor(harness.actor), idempotency_key: 'ant-arch-1' },
          ),
          'expediente_archived',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op15_error_schema_unchanged', async () => {
        const { executeOp15 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedActivePatient('ANT-SCH-1');
        const before = await harness.nativeSnapshot();
        const actor = { ...clinicalActor(harness.actor), idempotency_key: 'ant-sch-1' };
        await expectCode(
          executeOp15(
            harness.context,
            op15(seeded.id_paciente, { ...validAntecedente(), tipo: 'inventado' }),
            actor,
          ),
          'invalid_body',
        );
        await expectCode(
          executeOp15(
            harness.context,
            op15(seeded.id_paciente, {
              ...validAntecedente(),
              fecha_inicio: '2999-01-01',
            }),
            { ...actor, idempotency_key: 'ant-sch-2' },
          ),
          'invalid_body',
        );
        await expectCode(
          executeOp15(
            harness.context,
            op15(seeded.id_paciente, {
              ...validAntecedente(),
              extra: true,
            }),
            { ...actor, idempotency_key: 'ant-sch-3' },
          ),
          'invalid_body',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op15_error_store_unchanged', async () => {
        const { executeOp15 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedActivePatient('ANT-STORE-1');
        const before = await harness.nativeSnapshot();
        harness.setStoreUnavailable(true);
        await expectCode(
          executeOp15(
            harness.context,
            op15(seeded.id_paciente, validAntecedente()),
            { ...clinicalActor(harness.actor), idempotency_key: 'ant-store-1' },
          ),
          'store_unavailable',
        );
        harness.setStoreUnavailable(false);
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op15_error_role_unchanged', async () => {
        const { executeOp15 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedActivePatient('ANT-ROLE-1');
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp15(
            harness.context,
            op15(seeded.id_paciente, validAntecedente()),
            {
              ...forbiddenActor(harness.actor),
              idempotency_key: 'ant-role-1',
            },
          ),
          'forbidden',
        );
        await expectCode(
          executeOp15(
            harness.context,
            op15(seeded.id_paciente, validAntecedente()),
            {
              ...receptionActor(harness.actor),
              idempotency_key: 'ant-role-2',
            },
          ),
          'forbidden',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op15_error_foreign_unchanged', async () => {
        const { executeOp15 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        await harness.seedActivePatient('ANT-HOME-1');
        const other = await harness.otherInstitution();
        await other.reset();
        const foreign = await other.seedActivePatient('ANT-FOREIGN-1');
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp15(
            harness.context,
            op15(foreign.id_paciente, validAntecedente()),
            { ...clinicalActor(harness.actor), idempotency_key: 'ant-foreign-1' },
          ),
          'not_found',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await other.close();
        await harness.close();
      });

      it('op15_midwrite_rolls_back', async () => {
        const { executeOp15 } = await loadRecordApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedActivePatient('ANT-MID-1');
        const before = await harness.nativeSnapshot();
        const beforeCounts = await harness.counts();
        harness.failAfterWrite(1);
        await expectCode(
          executeOp15(
            harness.context,
            op15(seeded.id_paciente, validAntecedente({ descripcion: 'Debe revertirse' })),
            { ...clinicalActor(harness.actor), idempotency_key: 'ant-mid-1' },
          ),
          'internal_error',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        expect(await harness.counts()).toEqual(beforeCounts);
        await harness.close();
      });
    }

    it('contract_ops_fingerprint_stable', () => {
      expect(fingerprint(ops.slice().sort((a, b) => a - b))).toMatch(/^[a-f0-9]{64}$/);
    });
  });
}
