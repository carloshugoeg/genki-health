import type { ADMISION } from '@genki/shared/full/schema';
import { ClinicalError } from '../../domain/clinical-error.js';
import { assertDischargeRole, parseOp38Body } from '../../domain/full/discharge.js';
import { assertPositiveId, requireIdempotencyKey } from '../../domain/full/specialty-common.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { Op38Request } from '../../ports/full/discharge.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp38(
  context: FullContext,
  input: Op38Request,
  actor: OperationContext,
): Promise<ADMISION> {
  assertDischargeRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  const body = parseOp38Body(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.discharge.op38(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}
