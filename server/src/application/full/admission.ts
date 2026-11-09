import type { ADMISION, CAMA } from '@genki/shared/full/admission';
import { ClinicalError } from '../../domain/clinical-error.js';
import {
  assertAdmissionRole,
  parseOp34Query,
  parseOp35Body,
  parsePatientIdParam,
} from '../../domain/full/admission.js';
import { requireIdempotencyKey } from '../../domain/full/specialty-common.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { Op34Request, Op35Request } from '../../ports/full/admission.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp34(
  context: FullContext,
  input: Op34Request,
  actor: OperationContext,
): Promise<CAMA[]> {
  assertAdmissionRole(actor.roles);
  const query = parseOp34Query(input.query as Record<string, unknown>);
  try {
    return await context.modules.admission.op34(
      { params: {}, query, body: {} },
      { ...actor, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp35(
  context: FullContext,
  input: Op35Request,
  actor: OperationContext,
): Promise<ADMISION> {
  assertAdmissionRole(actor.roles);
  const id = parsePatientIdParam(input.params);
  const body = parseOp35Body(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.admission.op35(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}
