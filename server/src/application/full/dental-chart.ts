import type { ODONTOGRAMA, PIEZA_DENTAL } from '@genki/shared/full/dental-chart';
import { ClinicalError } from '../../domain/clinical-error.js';
import {
  assertDentalRole,
  parseOdontogramaBody,
  parsePiezaPatch,
} from '../../domain/full/dental-chart.js';
import { assertPositiveId, requireIdempotencyKey } from '../../domain/full/specialty-common.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { Op55Request, Op56Request } from '../../ports/full/dental-chart.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp55(
  context: FullContext,
  input: Op55Request,
  actor: OperationContext,
): Promise<ODONTOGRAMA> {
  assertDentalRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  const body = parseOdontogramaBody(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.dentalChart.op55(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp56(
  context: FullContext,
  input: Op56Request,
  actor: OperationContext,
): Promise<PIEZA_DENTAL> {
  assertDentalRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  const numero = assertPositiveId(input.params.numero);
  const body = parsePiezaPatch(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.dentalChart.op56(
      { params: { id, numero }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}
