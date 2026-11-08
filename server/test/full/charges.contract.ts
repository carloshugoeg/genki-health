import { describe, expect, it } from 'vitest';
import type { CargoInput, SERVICIO_FACTURABLE } from '@genki/shared/full/charges';
import { ClinicalError } from '../../src/domain/clinical-error.js';
import { executeOp68, executeOp69 } from '../../src/application/full/charges.js';
import type { FullContext, OperationContext } from '../../src/ports/full/context.js';

export type FullHarness = {
  context: FullContext;
  actor: OperationContext;
  reset(): Promise<void>;
  counts(): Promise<Record<string, number>>;
  nativeSnapshot(): Promise<Record<string, string>>;
  failAfterWrite(n: number): void;
  otherInstitution(): Promise<FullHarness>;
  close(): Promise<void>;
  seedPatient(doc?: string): Promise<{ id_paciente: number; id_expediente: number }>;
  seedServicio(overrides?: Partial<SERVICIO_FACTURABLE>): SERVICIO_FACTURABLE;
  setStoreUnavailable(value: boolean): void;
  withActor(patch: Partial<OperationContext>): OperationContext;
};

function errorCode(err: unknown): string | undefined {
  if (err instanceof ClinicalError) return err.code;
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

function manualCargo(id_paciente: number, overrides: Partial<CargoInput> = {}): CargoInput {
  return {
    id_paciente,
    codigo_servicio: 'CONS-01',
    origen: 'manual',
    cantidad: '1.00',
    clave_evento: `evt-${id_paciente}-1`,
    ...overrides,
  };
}

/**
 * Module contract for charges. `ops` selects OP chunks (68/69 for FS-23-C01).
 * F4 HTTP statuses map to ClinicalError codes at this core layer.
 */
export function moduleContract(
  name: string,
  make: () => Promise<FullHarness>,
  ops: readonly number[],
): void {
  const want = new Set(ops);

  describe(`chargesContract:${name}`, () => {
    if (want.has(68)) {
      it('op68_transition_1_persists', async () => {
        // F4: absent>pendiente → 201
        const h = await make();
        await h.reset();
        const patient = await h.seedPatient('C68-OK-1');
        h.seedServicio();
        const before = await h.nativeSnapshot();
        const beforeCounts = await h.counts();
        const cargo = await executeOp68(
          h.context,
          {
            params: {},
            query: {},
            body: manualCargo(patient.id_paciente, { clave_evento: 'evt-ok-1' }),
          },
          h.withActor({ roles: ['caja'] }),
        );
        expect(cargo.estado).toBe('pendiente');
        expect(cargo.codigo_servicio).toBe('CONS-01');
        expect(cargo.descripcion).toBe('Consulta general');
        expect(cargo.precio_unitario).toBe('100.00');
        expect(cargo.subtotal).toBe('100.00');
        expect(cargo.cantidad).toBe(1);
        expect(cargo.id_expediente).toBe(patient.id_expediente);
        expect(cargo.origen).toBe('manual');
        const afterCounts = await h.counts();
        expect(afterCounts.cargos).toBe(beforeCounts.cargos + 1);
        expect(await h.nativeSnapshot()).not.toEqual(before);
        await h.close();
      });

      it('op68_error_domain_unchanged', async () => {
        // F4: 409 conflict
        const h = await make();
        await h.reset();
        const patient = await h.seedPatient('C68-DOM-1');
        h.seedServicio();
        const actor = h.withActor({ roles: ['caja'] });
        await executeOp68(
          h.context,
          {
            params: {},
            query: {},
            body: manualCargo(patient.id_paciente, { clave_evento: 'evt-dup' }),
          },
          actor,
        );
        const snap = await h.nativeSnapshot();
        const counts = await h.counts();
        await expectCode(
          executeOp68(
            h.context,
            {
              params: {},
              query: {},
              body: manualCargo(patient.id_paciente, {
                clave_evento: 'evt-dup',
                cantidad: '2.00',
              }),
            },
            { ...actor, idempotency_key: 'idem-different' },
          ),
          'conflict',
        );
        expect(await h.nativeSnapshot()).toEqual(snap);
        expect(await h.counts()).toEqual(counts);
        await h.close();
      });

      it('op68_error_schema_unchanged', async () => {
        // F4: 400 invalid_body
        const h = await make();
        await h.reset();
        const patient = await h.seedPatient('C68-SCH-1');
        h.seedServicio();
        const snap = await h.nativeSnapshot();
        await expectCode(
          executeOp68(
            h.context,
            {
              params: {},
              query: {},
              body: {
                ...manualCargo(patient.id_paciente),
                extra: true,
              } as unknown as CargoInput,
            },
            h.withActor({ roles: ['caja'] }),
          ),
          'invalid_body',
        );
        expect(await h.nativeSnapshot()).toEqual(snap);
        await h.close();
      });

      it('op68_error_store_unchanged', async () => {
        // F4: 503 store_unavailable
        const h = await make();
        await h.reset();
        const patient = await h.seedPatient('C68-STO-1');
        h.seedServicio();
        const snap = await h.nativeSnapshot();
        h.setStoreUnavailable(true);
        await expectCode(
          executeOp68(
            h.context,
            { params: {}, query: {}, body: manualCargo(patient.id_paciente) },
            h.withActor({ roles: ['caja'] }),
          ),
          'store_unavailable',
        );
        expect(await h.nativeSnapshot()).toEqual(snap);
        await h.close();
      });

      it('op68_error_role_unchanged', async () => {
        // F4: 403 forbidden
        const h = await make();
        await h.reset();
        const patient = await h.seedPatient('C68-ROL-1');
        h.seedServicio();
        const snap = await h.nativeSnapshot();
        await expectCode(
          executeOp68(
            h.context,
            { params: {}, query: {}, body: manualCargo(patient.id_paciente) },
            h.withActor({ roles: ['medico'] }),
          ),
          'forbidden',
        );
        expect(await h.nativeSnapshot()).toEqual(snap);
        await h.close();
      });

      it('op68_error_foreign_unchanged', async () => {
        // F4: 404 not_found
        const h = await make();
        await h.reset();
        h.seedServicio();
        const snap = await h.nativeSnapshot();
        await expectCode(
          executeOp68(
            h.context,
            {
              params: {},
              query: {},
              body: manualCargo(9_999_001, { clave_evento: 'evt-missing-patient' }),
            },
            h.withActor({ roles: ['caja'] }),
          ),
          'not_found',
        );
        expect(await h.nativeSnapshot()).toEqual(snap);
        await h.close();
      });

      it('op68_midwrite_rolls_back', async () => {
        // F4: 500 internal_error; rollback
        const h = await make();
        await h.reset();
        const patient = await h.seedPatient('C68-MID-1');
        h.seedServicio();
        const snap = await h.nativeSnapshot();
        const counts = await h.counts();
        h.failAfterWrite(1);
        await expectCode(
          executeOp68(
            h.context,
            {
              params: {},
              query: {},
              body: manualCargo(patient.id_paciente, { clave_evento: 'evt-mid' }),
            },
            h.withActor({ roles: ['caja'] }),
          ),
          'internal_error',
        );
        expect(await h.nativeSnapshot()).toEqual(snap);
        expect(await h.counts()).toEqual(counts);
        await h.close();
      });
    }

    if (want.has(69)) {
      it('op69_transition_1_persists', async () => {
        // F4: 200 pending list (read does not mutate); empty list is not 404
        const h = await make();
        await h.reset();
        const patient = await h.seedPatient('C69-OK-1');
        h.seedServicio();
        const actor = h.withActor({ roles: ['caja'] });
        await executeOp68(
          h.context,
          {
            params: {},
            query: {},
            body: manualCargo(patient.id_paciente, {
              clave_evento: 'evt-list-1',
              cantidad: '2.00',
            }),
          },
          actor,
        );
        const snap = await h.nativeSnapshot();
        const page = await executeOp69(
          h.context,
          { params: { id: patient.id_paciente }, query: { page: 1, page_size: 20 }, body: {} },
          h.withActor({ roles: ['recepcion'] }),
        );
        expect(page.total).toBe(1);
        expect(page.items).toHaveLength(1);
        expect(page.items[0]).toEqual({
          id_cargo: expect.any(Number),
          descripcion: 'Consulta general',
          cantidad: '2.00',
          precio_unitario: '100.00',
          subtotal: '200.00',
          estado: 'pendiente',
        });
        expect(page.items[0]).not.toHaveProperty('id_consulta');
        expect(page.items[0]).not.toHaveProperty('codigo_servicio');
        expect(await h.nativeSnapshot()).toEqual(snap);

        const emptyPatient = await h.seedPatient('C69-EMPTY');
        const empty = await executeOp69(
          h.context,
          { params: { id: emptyPatient.id_paciente }, query: {}, body: {} },
          h.withActor({ roles: ['caja'] }),
        );
        expect(empty.total).toBe(0);
        expect(empty.items).toEqual([]);
        await h.close();
      });

      it('op69_error_domain_unchanged', async () => {
        // F4: 404 not_found — bad parent, not empty list
        const h = await make();
        await h.reset();
        const snap = await h.nativeSnapshot();
        await expectCode(
          executeOp69(
            h.context,
            { params: { id: 9_999_002 }, query: {}, body: {} },
            h.withActor({ roles: ['caja'] }),
          ),
          'not_found',
        );
        expect(await h.nativeSnapshot()).toEqual(snap);
        await h.close();
      });

      it('op69_error_schema_unchanged', async () => {
        // F4: 400 invalid_query
        const h = await make();
        await h.reset();
        const patient = await h.seedPatient('C69-SCH-1');
        const snap = await h.nativeSnapshot();
        await expectCode(
          executeOp69(
            h.context,
            {
              params: { id: patient.id_paciente },
              query: { page: 1, page_size: 51 },
              body: {},
            },
            h.withActor({ roles: ['caja'] }),
          ),
          'invalid_query',
        );
        expect(await h.nativeSnapshot()).toEqual(snap);
        await h.close();
      });

      it('op69_error_store_unchanged', async () => {
        // F4: 503
        const h = await make();
        await h.reset();
        const patient = await h.seedPatient('C69-STO-1');
        const snap = await h.nativeSnapshot();
        h.setStoreUnavailable(true);
        await expectCode(
          executeOp69(
            h.context,
            { params: { id: patient.id_paciente }, query: {}, body: {} },
            h.withActor({ roles: ['caja'] }),
          ),
          'store_unavailable',
        );
        expect(await h.nativeSnapshot()).toEqual(snap);
        await h.close();
      });

      it('op69_error_role_unchanged', async () => {
        // F4: 403
        const h = await make();
        await h.reset();
        const patient = await h.seedPatient('C69-ROL-1');
        const snap = await h.nativeSnapshot();
        await expectCode(
          executeOp69(
            h.context,
            { params: { id: patient.id_paciente }, query: {}, body: {} },
            h.withActor({ roles: ['laboratorista'] }),
          ),
          'forbidden',
        );
        expect(await h.nativeSnapshot()).toEqual(snap);
        await h.close();
      });

      it('op69_error_foreign_unchanged', async () => {
        // F4: 404 — other institution isolation
        const h = await make();
        await h.reset();
        const other = await h.otherInstitution();
        await other.reset();
        const foreign = await other.seedPatient('C69-FOR-1');
        other.seedServicio();
        await executeOp68(
          other.context,
          {
            params: {},
            query: {},
            body: manualCargo(foreign.id_paciente, { clave_evento: 'evt-foreign' }),
          },
          other.withActor({ roles: ['caja'] }),
        );
        const snap = await h.nativeSnapshot();
        await expectCode(
          executeOp69(
            h.context,
            { params: { id: foreign.id_paciente }, query: {}, body: {} },
            h.withActor({ roles: ['caja'] }),
          ),
          'not_found',
        );
        expect(await h.nativeSnapshot()).toEqual(snap);
        await other.close();
        await h.close();
      });
    }
  });
}
