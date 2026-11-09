import type {
  ANTECEDENTE_PERINATAL,
  MEDICION_ANTROPOMETRICA,
} from '@genki/shared/full/growth';
import { ClinicalError } from '../../domain/clinical-error.js';
import {
  assertGrowthRole,
  parseIdParam,
  parseMedicionBody,
  parsePerinatalBody,
} from '../../domain/full/growth.js';
import { requireIdempotencyKey } from '../../domain/full/specialty-common.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { Op40Request, Op41Request, Op42Request } from '../../ports/full/growth.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp40(
  context: FullContext,
  input: Op40Request,
  actor: OperationContext,
): Promise<ANTECEDENTE_PERINATAL> {
  assertGrowthRole(actor.roles);
  const id = parseIdParam(input.params);
  const body = parsePerinatalBody(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.growth.op40(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp41(
  context: FullContext,
  input: Op41Request,
  actor: OperationContext,
): Promise<MEDICION_ANTROPOMETRICA> {
  assertGrowthRole(actor.roles);
  const id = parseIdParam(input.params);
  const body = parseMedicionBody(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.growth.op41(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp42(
  context: FullContext,
  input: Op42Request,
  actor: OperationContext,
): Promise<MEDICION_ANTROPOMETRICA[]> {
  assertGrowthRole(actor.roles);
  const id = parseIdParam(input.params);
  try {
    return await context.modules.growth.op42(
      { params: { id }, query: {}, body: {} },
      { ...actor, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}
