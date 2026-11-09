import type { NOTA_EVOLUCION } from '@genki/shared/full/schema';
import { ClinicalError } from '../../domain/clinical-error.js';
import { assertNoteRole, parseAdmissionIdParam, parseOp36Body } from '../../domain/full/procedure.js';
import { requireIdempotencyKey } from '../../domain/full/specialty-common.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { Op36Request } from '../../ports/full/procedure.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp36(
  context: FullContext,
  input: Op36Request,
  actor: OperationContext,
): Promise<NOTA_EVOLUCION> {
  assertNoteRole(actor.roles);
  const id = parseAdmissionIdParam(input.params);
  const body = parseOp36Body(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.procedure.op36(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}
