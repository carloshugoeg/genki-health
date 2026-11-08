import { describe, expect, it } from 'vitest';
import type { PacienteResumen } from '@genki/shared';
import { ClinicalError } from '../../src/domain/clinical-error.js';
import type { FullContext, OperationContext } from '../../src/ports/full/context.js';
import { executeOp09, executeOp10 } from '../../src/application/full/patient.js';

export type FullHarness = {
  context: FullContext;
  actor: OperationContext;
  reset(): Promise<void>;
  counts(): Promise<Record<string, number>>;
  nativeSnapshot(): Promise<Record<string, string>>;
  failAfterWrite(n: number): void;
  otherInstitution(): Promise<FullHarness>;
  close(): Promise<void>;
};

function clinicalHttpStatus(error: ClinicalError): number {
  switch (error.code) {
    case 'invalid_body':
    case 'invalid_query':
    case 'password_policy':
      return 400;
    case 'missing_bearer':
    case 'invalid_credentials':
    case 'invalid_token':
      return 401;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'duplicate_document':
    case 'conflict':
    case 'guardian_required':
    case 'invalid_guardians':
    case 'already_archived':
    case 'expediente_archived':
      return 409;
    case 'invalid_bundle':
    case 'reference_not_found':
      return 422;
    case 'store_unavailable':
      return 503;
    case 'internal_error':
    case 'misconfigured':
      return 500;
    default:
      return 500;
  }
}

async function expectFailure(
  run: () => Promise<unknown>,
  status: number,
  code: ClinicalError['code'],
): Promise<void> {
  try {
    await run();
    expect.fail(`expected ClinicalError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(ClinicalError);
    const clinical = error as ClinicalError;
    expect(clinical.code).toBe(code);
    expect(clinicalHttpStatus(clinical)).toBe(status);
  }
}

function samplePaciente(doc: string) {
  return {
    tipo_documento: 'DPI',
    numero_documento: doc,
    primer_nombre: 'Ana',
    primer_apellido: 'Prueba',
    fecha_nacimiento: '1990-01-15',
    sexo: 'F' as const,
    telefono: '50211111111',
  };
}

async function seedPaciente(harness: FullHarness, doc: string): Promise<PacienteResumen> {
  return harness.context.base.pacientes.createWithExpediente(samplePaciente(doc));
}

function withRoles(actor: OperationContext, roles: readonly string[]): OperationContext {
  return { ...actor, roles, permissions: roles };
}

/** Engine-neutral OP-09/OP-10 contract. Ops list selects this ticket's serial chunk. */
export function moduleContract(
  name: string,
  make: () => Promise<FullHarness>,
  ops: readonly number[],
): void {
  describe(`full/${name} contract`, () => {
    if (ops.includes(9)) {
      it('op09_transition_1_persists', async () => {
        const harness = await make();
        await harness.reset();
        const seeded = await seedPaciente(harness, 'op09-ok-1');
        const before = await harness.nativeSnapshot();
        const result = await executeOp09(
          harness.context,
          {
            params: { id: seeded.paciente.id_paciente },
            query: {},
            body: { telefono: '50299998888', primer_nombre: 'Anita' },
          },
          harness.actor,
        );
        expect(result.paciente.id_paciente).toBe(seeded.paciente.id_paciente);
        expect(result.paciente.telefono).toBe('50299998888');
        expect(result.paciente.primer_nombre).toBe('Anita');
        expect(result.paciente.fecha_registro).toBe(seeded.paciente.fecha_registro);
        expect(result.paciente.estado).toBe(seeded.paciente.estado);
        expect(result.paciente.id_institucion).toBe(seeded.paciente.id_institucion);
        expect(result.expediente.id_expediente).toBe(seeded.expediente.id_expediente);
        const after = await harness.nativeSnapshot();
        expect(after.pacientes).not.toBe(before.pacientes);
        const counts = await harness.counts();
        expect(counts.pacientes).toBe(1);
        await harness.close();
      });

      it('op09_error_domain_unchanged', async () => {
        const harness = await make();
        await harness.reset();
        const first = await seedPaciente(harness, 'op09-dup-a');
        await seedPaciente(harness, 'op09-dup-b');
        const before = await harness.nativeSnapshot();
        await expectFailure(
          () =>
            executeOp09(
              harness.context,
              {
                params: { id: first.paciente.id_paciente },
                query: {},
                body: { numero_documento: 'op09-dup-b' },
              },
              harness.actor,
            ),
          409,
          'duplicate_document',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op09_error_schema_unchanged', async () => {
        const harness = await make();
        await harness.reset();
        const seeded = await seedPaciente(harness, 'op09-schema-1');
        const before = await harness.nativeSnapshot();
        await expectFailure(
          () =>
            executeOp09(
              harness.context,
              {
                params: { id: seeded.paciente.id_paciente },
                query: {},
                body: {},
              },
              harness.actor,
            ),
          400,
          'invalid_body',
        );
        await expectFailure(
          () =>
            executeOp09(
              harness.context,
              {
                params: { id: seeded.paciente.id_paciente },
                query: {},
                body: { fecha_nacimiento: '2999-01-01' },
              },
              harness.actor,
            ),
          400,
          'invalid_body',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op09_error_store_unchanged', async () => {
        const harness = await make();
        await harness.reset();
        const seeded = await seedPaciente(harness, 'op09-store-1');
        const before = await harness.nativeSnapshot();
        harness.failAfterWrite(0);
        await expectFailure(
          () =>
            executeOp09(
              harness.context,
              {
                params: { id: seeded.paciente.id_paciente },
                query: {},
                body: { telefono: '50200001111' },
              },
              harness.actor,
            ),
          503,
          'store_unavailable',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op09_error_role_unchanged', async () => {
        const harness = await make();
        await harness.reset();
        const seeded = await seedPaciente(harness, 'op09-role-1');
        const before = await harness.nativeSnapshot();
        await expectFailure(
          () =>
            executeOp09(
              harness.context,
              {
                params: { id: seeded.paciente.id_paciente },
                query: {},
                body: { telefono: '50200002222' },
              },
              withRoles(harness.actor, ['caja']),
            ),
          403,
          'forbidden',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op09_error_foreign_unchanged', async () => {
        const harness = await make();
        await harness.reset();
        const local = await seedPaciente(harness, 'op09-foreign-local');
        const other = await harness.otherInstitution();
        await other.reset();
        const foreign = await seedPaciente(other, 'op09-foreign-other');
        const before = await harness.nativeSnapshot();
        await expectFailure(
          () =>
            executeOp09(
              harness.context,
              {
                params: { id: foreign.paciente.id_paciente },
                query: {},
                body: { telefono: '50200003333' },
              },
              harness.actor,
            ),
          404,
          'not_found',
        );
        await expectFailure(
          () =>
            executeOp09(
              harness.context,
              {
                params: { id: local.paciente.id_paciente + 999_999 },
                query: {},
                body: { telefono: '50200003333' },
              },
              harness.actor,
            ),
          404,
          'not_found',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
        await other.close();
      });

      it('op09_midwrite_rolls_back', async () => {
        const harness = await make();
        await harness.reset();
        const seeded = await seedPaciente(harness, 'op09-mid-1');
        const before = await harness.nativeSnapshot();
        harness.failAfterWrite(1);
        await expectFailure(
          () =>
            executeOp09(
              harness.context,
              {
                params: { id: seeded.paciente.id_paciente },
                query: {},
                body: { telefono: '50200004444' },
              },
              harness.actor,
            ),
          500,
          'internal_error',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        const still = await harness.context.base.pacientes.findById(seeded.paciente.id_paciente);
        expect(still?.telefono).toBe(seeded.paciente.telefono);
        await harness.close();
      });
    }

    if (ops.includes(10)) {
      it('op10_transition_1_persists', async () => {
        const harness = await make();
        await harness.reset();
        const seeded = await seedPaciente(harness, 'op10-ok-1');
        const beforeFirst = await harness.nativeSnapshot();
        const first = await executeOp10(
          harness.context,
          {
            params: { id: seeded.paciente.id_paciente },
            query: {},
            body: {
              nombre_completo: 'Carlos Tutor',
              parentesco: 'padre',
              telefono: '50255550001',
              es_principal: true,
            },
          },
          harness.actor,
        );
        expect(first.id_paciente).toBe(seeded.paciente.id_paciente);
        expect(first.es_principal).toBe(true);
        expect(first.id_contacto).toBeGreaterThan(0);
        const afterFirst = await harness.nativeSnapshot();
        expect(afterFirst.contactos).not.toBe(beforeFirst.contactos);

        const second = await executeOp10(
          harness.context,
          {
            params: { id: seeded.paciente.id_paciente },
            query: {},
            body: {
              nombre_completo: 'Luisa Tutor',
              parentesco: 'madre',
              telefono: '50255550002',
              telefono_alterno: null,
              es_principal: true,
            },
          },
          harness.actor,
        );
        expect(second.es_principal).toBe(true);
        expect(second.id_contacto).not.toBe(first.id_contacto);
        const counts = await harness.counts();
        expect(counts.contactos).toBe(2);
        const afterSecond = await harness.nativeSnapshot();
        expect(afterSecond.contactos).not.toBe(afterFirst.contactos);
        await harness.close();
      });

      it('op10_error_domain_unchanged', async () => {
        const harness = await make();
        await harness.reset();
        const seeded = await seedPaciente(harness, 'op10-dom-1');
        await executeOp10(
          harness.context,
          {
            params: { id: seeded.paciente.id_paciente },
            query: {},
            body: {
              nombre_completo: 'Repetido',
              parentesco: 'otro',
              telefono: '50255551111',
              es_principal: true,
            },
          },
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        await expectFailure(
          () =>
            executeOp10(
              harness.context,
              {
                params: { id: seeded.paciente.id_paciente },
                query: {},
                body: {
                  nombre_completo: 'Repetido',
                  parentesco: 'otro',
                  telefono: '50255551111',
                  es_principal: false,
                },
              },
              harness.actor,
            ),
          409,
          'conflict',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op10_error_schema_unchanged', async () => {
        const harness = await make();
        await harness.reset();
        const seeded = await seedPaciente(harness, 'op10-schema-1');
        const before = await harness.nativeSnapshot();
        await expectFailure(
          () =>
            executeOp10(
              harness.context,
              {
                params: { id: seeded.paciente.id_paciente },
                query: {},
                body: {
                  nombre_completo: '',
                  parentesco: 'padre',
                  telefono: '50255552222',
                  es_principal: true,
                },
              },
              harness.actor,
            ),
          400,
          'invalid_body',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op10_error_store_unchanged', async () => {
        const harness = await make();
        await harness.reset();
        const seeded = await seedPaciente(harness, 'op10-store-1');
        const before = await harness.nativeSnapshot();
        harness.failAfterWrite(0);
        await expectFailure(
          () =>
            executeOp10(
              harness.context,
              {
                params: { id: seeded.paciente.id_paciente },
                query: {},
                body: {
                  nombre_completo: 'Store Down',
                  parentesco: 'otro',
                  telefono: '50255553333',
                  es_principal: true,
                },
              },
              harness.actor,
            ),
          503,
          'store_unavailable',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op10_error_role_unchanged', async () => {
        const harness = await make();
        await harness.reset();
        const seeded = await seedPaciente(harness, 'op10-role-1');
        const before = await harness.nativeSnapshot();
        await expectFailure(
          () =>
            executeOp10(
              harness.context,
              {
                params: { id: seeded.paciente.id_paciente },
                query: {},
                body: {
                  nombre_completo: 'Role Denied',
                  parentesco: 'otro',
                  telefono: '50255554444',
                  es_principal: true,
                },
              },
              withRoles(harness.actor, ['auditor']),
            ),
          403,
          'forbidden',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op10_error_foreign_unchanged', async () => {
        const harness = await make();
        await harness.reset();
        await seedPaciente(harness, 'op10-foreign-local');
        const other = await harness.otherInstitution();
        await other.reset();
        const foreign = await seedPaciente(other, 'op10-foreign-other');
        const before = await harness.nativeSnapshot();
        await expectFailure(
          () =>
            executeOp10(
              harness.context,
              {
                params: { id: foreign.paciente.id_paciente },
                query: {},
                body: {
                  nombre_completo: 'Foreign',
                  parentesco: 'otro',
                  telefono: '50255555555',
                  es_principal: true,
                },
              },
              harness.actor,
            ),
          404,
          'not_found',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
        await other.close();
      });

      it('op10_midwrite_rolls_back', async () => {
        const harness = await make();
        await harness.reset();
        const seeded = await seedPaciente(harness, 'op10-mid-1');
        await executeOp10(
          harness.context,
          {
            params: { id: seeded.paciente.id_paciente },
            query: {},
            body: {
              nombre_completo: 'Primero',
              parentesco: 'padre',
              telefono: '50255556666',
              es_principal: true,
            },
          },
          harness.actor,
        );
        const before = await harness.nativeSnapshot();
        harness.failAfterWrite(1);
        await expectFailure(
          () =>
            executeOp10(
              harness.context,
              {
                params: { id: seeded.paciente.id_paciente },
                query: {},
                body: {
                  nombre_completo: 'Segundo',
                  parentesco: 'madre',
                  telefono: '50255557777',
                  es_principal: true,
                },
              },
              harness.actor,
            ),
          500,
          'internal_error',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        const counts = await harness.counts();
        expect(counts.contactos).toBe(1);
        await harness.close();
      });
    }
  });
}
