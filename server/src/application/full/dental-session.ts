import type { DentalBalance, SESION_TRATAMIENTO } from '@genki/shared/full/dental-session';
import { ClinicalError } from '../../domain/clinical-error.js';
import {
  assertDentalSessionRole,
  parsePatientIdParam,
  parsePlanIdParam,
  parseSesionInput,
} from '../../domain/full/dental-session.js';
import { requireIdempotencyKey } from '../../domain/full/specialty-common.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { Op59Request, Op60Request } from '../../ports/full/dental-session.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp59(
  context: FullContext,
  input: Op59Request,
  actor: OperationContext,
): Promise<SESION_TRATAMIENTO> {
  assertDentalSessionRole(actor.roles);
  const id = parsePlanIdParam(input.params);
  const body = parseSesionInput(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.dentalSession.op59(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp60(
  context: FullContext,
  input: Op60Request,
  actor: OperationContext,
): Promise<DentalBalance> {
  assertDentalSessionRole(actor.roles);
  const id = parsePatientIdParam(input.params);
  try {
    return await context.modules.dentalSession.op60({ params: { id }, query: {}, body: {} }, actor);
  } catch (err) {
    rethrow(err);
  }
}
