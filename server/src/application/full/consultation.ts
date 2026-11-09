import type { ConsultaDraft, SIGNOS_VITALES } from '@genki/shared/full/consultation';
import { ClinicalError } from '../../domain/clinical-error.js';
import {
  assertConsultationOpenRole,
  assertConsultationVitalsRole,
  parseOpenConsultaInput,
  parseOp26Params,
  parseOp27Params,
  parseSignosVitalesInput,
  requireIdempotencyKey,
} from '../../domain/full/consultation.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { Op26Request, Op27Request } from '../../ports/full/consultation.js';

function rethrowFailure(err: unknown): never {
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

export async function executeOp26(
  context: FullContext,
  input: Op26Request,
  actor: OperationContext,
): Promise<ConsultaDraft> {
  assertConsultationOpenRole(actor.roles);
  const id = parseOp26Params(input.params);
  const body = parseOpenConsultaInput(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.consultation.op26(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrowFailure(err);
  }
}

export async function executeOp27(
  context: FullContext,
  input: Op27Request,
  actor: OperationContext,
): Promise<SIGNOS_VITALES> {
  assertConsultationVitalsRole(actor.roles);
  const id = parseOp27Params(input.params);
  const body = parseSignosVitalesInput(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.consultation.op27(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrowFailure(err);
  }
}
