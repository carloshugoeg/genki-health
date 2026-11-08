import type { DOCUMENTO_ADJUNTO } from '@genki/shared/full/attachments';
import { ClinicalError } from '../../domain/clinical-error.js';
import {
  assertAttachmentClinicalRole,
  parseAttachEnvelope,
  parseOp17Params,
  requireIdempotencyKey,
  toValidatedAttachInput,
} from '../../domain/full/attachments.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { Op17Request } from '../../ports/full/attachments.js';

function rethrowAttachmentsFailure(err: unknown): never {
  if (err instanceof ClinicalError) {
    throw err;
  }
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (code === 'internal_error') {
      throw new ClinicalError('internal_error', 'Error interno');
    }
    if (code === 'store_unavailable') {
      throw new ClinicalError('store_unavailable', 'Almacenamiento no disponible');
    }
  }
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp17(
  context: FullContext,
  input: Op17Request,
  actor: OperationContext,
): Promise<DOCUMENTO_ADJUNTO> {
  assertAttachmentClinicalRole(actor.roles);
  const id = parseOp17Params(input.params);
  const envelope = parseAttachEnvelope(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  const buffer = new Uint8Array(await envelope.archivo.arrayBuffer());
  const validated = toValidatedAttachInput(envelope, buffer);
  const body = {
    archivo: new File([validated.bytes], validated.nombre_archivo, {
      type: validated.tipo_mime,
    }),
    ...(validated.id_consulta !== undefined ? { id_consulta: validated.id_consulta } : {}),
  };
  try {
    return await context.modules.attachments.op17(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrowAttachmentsFailure(err);
  }
}
