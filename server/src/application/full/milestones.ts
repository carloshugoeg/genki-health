import type { SEGUIMIENTO_HITO } from '@genki/shared/full/milestones';
import { ClinicalError } from '../../domain/clinical-error.js';
import { assertMilestoneRole, parseHitoBody, parseHitoParams } from '../../domain/full/milestones.js';
import { requireIdempotencyKey } from '../../domain/full/specialty-common.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { Op46Request } from '../../ports/full/milestones.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp46(
  context: FullContext,
  input: Op46Request,
  actor: OperationContext,
): Promise<SEGUIMIENTO_HITO> {
  assertMilestoneRole(actor.roles);
  const params = parseHitoParams(input.params);
  const body = parseHitoBody(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.milestones.op46(
      { params, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}
