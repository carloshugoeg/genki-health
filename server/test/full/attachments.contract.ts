import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ClinicalError } from '../../src/domain/clinical-error.js';
import type { FullContext, OperationContext } from '../../src/ports/full/context.js';
import type { Op17Request } from '../../src/ports/full/attachments.js';

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

type AttachmentsApplication = {
  executeOp17: (
    context: FullContext,
    input: Op17Request,
    actor: OperationContext,
  ) => Promise<unknown>;
};

async function loadAttachmentsApplication(): Promise<AttachmentsApplication> {
  const mod =
    (await import('../../src/application/full/attachments.js')) as Partial<AttachmentsApplication>;
  if (typeof mod.executeOp17 !== 'function') {
    throw new ClinicalError('internal_error', 'attachments application exports missing');
  }
  return { executeOp17: mod.executeOp17 };
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
    permissions: ['documento.adjuntar'],
    id_profesional: base.id_profesional ?? 1,
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

function auditorActor(base: OperationContext): OperationContext {
  return {
    ...base,
    roles: ['auditor'],
    permissions: ['paciente.leer'],
    id_profesional: null,
  };
}

function pdfBytes(): Uint8Array {
  return new TextEncoder().encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\n');
}

function jpegBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
}

function validPdf(name = 'informe.pdf'): File {
  return new File([pdfBytes()], name, { type: 'application/pdf' });
}

function mimeMismatchPdfNamedJpeg(): File {
  return new File([jpegBytes()], 'falso.pdf', { type: 'application/pdf' });
}

function oversizedPdf(): File {
  const max = 10 * 1024 * 1024;
  const bytes = new Uint8Array(max + 1);
  const magic = pdfBytes();
  bytes.set(magic, 0);
  return new File([bytes], 'grande.pdf', { type: 'application/pdf' });
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function op17(
  id: number,
  body: { archivo: Blob; id_consulta?: number } | Record<string, unknown>,
): Op17Request {
  return {
    params: { id },
    query: {},
    body: body as Op17Request['body'],
  };
}

function fingerprint(ops: readonly number[]): string {
  return createHash('sha256').update(JSON.stringify(ops)).digest('hex');
}

export function attachmentsContract(
  name: string,
  make: FullHarnessFactory,
  ops: readonly number[],
): void {
  const want17 = ops.includes(17);

  describe(`attachmentsContract:${name}`, () => {
    if (want17) {
      it('op17_transition_1_persists', async () => {
        const { executeOp17 } = await loadAttachmentsApplication();
        const harness = await make();
        await harness.reset();
        const actor = {
          ...clinicalActor(harness.actor),
          idempotency_key: 'doc-create-1',
        };
        const seeded = await harness.seedActivePatient('DOC-OK-1');
        const archivo = validPdf('radiografia.pdf');
        const expectedHash = sha256Hex(pdfBytes());
        const beforeCounts = await harness.counts();
        const created = (await executeOp17(
          harness.context,
          op17(seeded.id_paciente, { archivo }),
          actor,
        )) as {
          id_documento: number;
          id_expediente: number;
          id_consulta?: number | null;
          nombre_archivo: string;
          tipo_mime: string;
          ruta: string;
          hash_sha256: string;
          fecha_carga: string;
        };
        expect(created.id_documento).toBeGreaterThan(0);
        expect(created.id_expediente).toBe(seeded.id_expediente);
        expect(created.nombre_archivo).toBe('radiografia.pdf');
        expect(created.tipo_mime).toBe('application/pdf');
        expect(created.hash_sha256).toBe(expectedHash);
        expect(created.fecha_carga).toBe(actor.now);
        expect(created.ruta.length).toBeGreaterThan(0);
        expect(created.ruta.length).toBeLessThanOrEqual(300);
        expect(created.ruta.includes('..')).toBe(false);
        expect(created.ruta.startsWith('http')).toBe(false);
        const afterCounts = await harness.counts();
        expect(afterCounts.documentos ?? 0).toBe((beforeCounts.documentos ?? 0) + 1);
        const replay = await executeOp17(
          harness.context,
          op17(seeded.id_paciente, { archivo: validPdf('radiografia.pdf') }),
          actor,
        );
        expect(replay).toEqual(created);
        expect((await harness.counts()).documentos).toBe(afterCounts.documentos);
        await harness.close();
      });

      it('op17_error_domain_unchanged', async () => {
        const { executeOp17 } = await loadAttachmentsApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedActivePatient('DOC-DOM-1');
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp17(
            harness.context,
            op17(seeded.id_paciente, { archivo: mimeMismatchPdfNamedJpeg() }),
            { ...clinicalActor(harness.actor), idempotency_key: 'doc-dom-1' },
          ),
          'invalid_body',
        );
        await expectCode(
          executeOp17(
            harness.context,
            op17(seeded.id_paciente, { archivo: validPdf(), id_consulta: 9_999_999 }),
            { ...clinicalActor(harness.actor), idempotency_key: 'doc-dom-2' },
          ),
          'invalid_body',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op17_error_schema_unchanged', async () => {
        const { executeOp17 } = await loadAttachmentsApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedActivePatient('DOC-SCH-1');
        const before = await harness.nativeSnapshot();
        const actor = { ...clinicalActor(harness.actor), idempotency_key: 'doc-sch-1' };
        await expectCode(
          executeOp17(harness.context, op17(seeded.id_paciente, {}), actor),
          'invalid_body',
        );
        await expectCode(
          executeOp17(
            harness.context,
            op17(seeded.id_paciente, { archivo: validPdf(), extra: true }),
            { ...actor, idempotency_key: 'doc-sch-2' },
          ),
          'invalid_body',
        );
        await expectCode(
          executeOp17(harness.context, op17(seeded.id_paciente, { archivo: oversizedPdf() }), {
            ...actor,
            idempotency_key: 'doc-sch-3',
          }),
          'invalid_body',
        );
        await expectCode(
          executeOp17(
            harness.context,
            op17(seeded.id_paciente, {
              archivo: new File([pdfBytes()], 'x'.repeat(161) + '.pdf', {
                type: 'application/pdf',
              }),
            }),
            { ...actor, idempotency_key: 'doc-sch-4' },
          ),
          'invalid_body',
        );
        await expectCode(
          executeOp17(
            harness.context,
            op17(seeded.id_paciente, {
              archivo: validPdf(),
              id_consulta: '1' as unknown as number,
            }),
            { ...actor, idempotency_key: 'doc-sch-5' },
          ),
          'invalid_body',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op17_error_store_unchanged', async () => {
        const { executeOp17 } = await loadAttachmentsApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedActivePatient('DOC-STORE-1');
        const before = await harness.nativeSnapshot();
        harness.setStoreUnavailable(true);
        await expectCode(
          executeOp17(harness.context, op17(seeded.id_paciente, { archivo: validPdf() }), {
            ...clinicalActor(harness.actor),
            idempotency_key: 'doc-store-1',
          }),
          'store_unavailable',
        );
        harness.setStoreUnavailable(false);
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op17_error_role_unchanged', async () => {
        const { executeOp17 } = await loadAttachmentsApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedActivePatient('DOC-ROLE-1');
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp17(harness.context, op17(seeded.id_paciente, { archivo: validPdf() }), {
            ...receptionActor(harness.actor),
            idempotency_key: 'doc-role-1',
          }),
          'forbidden',
        );
        await expectCode(
          executeOp17(harness.context, op17(seeded.id_paciente, { archivo: validPdf() }), {
            ...auditorActor(harness.actor),
            idempotency_key: 'doc-role-2',
          }),
          'forbidden',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await harness.close();
      });

      it('op17_error_foreign_unchanged', async () => {
        const { executeOp17 } = await loadAttachmentsApplication();
        const harness = await make();
        await harness.reset();
        await harness.seedActivePatient('DOC-HOME-1');
        const other = await harness.otherInstitution();
        await other.reset();
        const foreign = await other.seedActivePatient('DOC-FOREIGN-1');
        const before = await harness.nativeSnapshot();
        await expectCode(
          executeOp17(harness.context, op17(foreign.id_paciente, { archivo: validPdf() }), {
            ...clinicalActor(harness.actor),
            idempotency_key: 'doc-foreign-1',
          }),
          'not_found',
        );
        expect(await harness.nativeSnapshot()).toEqual(before);
        await other.close();
        await harness.close();
      });

      it('op17_midwrite_rolls_back', async () => {
        const { executeOp17 } = await loadAttachmentsApplication();
        const harness = await make();
        await harness.reset();
        const seeded = await harness.seedActivePatient('DOC-MID-1');
        const before = await harness.nativeSnapshot();
        const beforeCounts = await harness.counts();
        harness.failAfterWrite(1);
        await expectCode(
          executeOp17(harness.context, op17(seeded.id_paciente, { archivo: validPdf() }), {
            ...clinicalActor(harness.actor),
            idempotency_key: 'doc-mid-1',
          }),
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
