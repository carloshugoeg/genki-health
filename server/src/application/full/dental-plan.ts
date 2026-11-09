import type { PLAN_TRATAMIENTO } from '@genki/shared/full/dental-plan';
import { ClinicalError } from '../../domain/clinical-error.js';
import { assertDentalPlanRole, parsePlanInput } from '../../domain/full/dental-plan.js';
import { assertPositiveId, requireIdempotencyKey } from '../../domain/full/specialty-common.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { Op57Request, Op58Request } from '../../ports/full/dental-plan.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp57(
  context: FullContext,
  input: Op57Request,
  actor: OperationContext,
): Promise<PLAN_TRATAMIENTO> {
  assertDentalPlanRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  const body = parsePlanInput(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.dentalPlan.op57(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp58(
  context: FullContext,
  input: Op58Request,
  actor: OperationContext,
): Promise<PLAN_TRATAMIENTO> {
  assertDentalPlanRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.dentalPlan.op58(
      { params: { id }, query: {}, body: {} },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}
