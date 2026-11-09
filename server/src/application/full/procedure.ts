import type { NOTA_EVOLUCION, PROCEDIMIENTO } from '@genki/shared/full/schema';
import { ClinicalError } from '../../domain/clinical-error.js';
import {
  assertNoteRole,
  assertProcedureRole,
  parseAdmissionIdParam,
  parseOp36Body,
  parseOp37Body,
} from '../../domain/full/procedure.js';
import { requireIdempotencyKey } from '../../domain/full/specialty-common.js';
import { PROFESIONAL_NO_VINCULADO } from '../../domain/full/clinical-maintenance.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { Op36Request, Op37Request } from '../../ports/full/procedure.js';

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

export async function executeOp37(
  context: FullContext,
  input: Op37Request,
  actor: OperationContext,
): Promise<PROCEDIMIENTO> {
  assertProcedureRole(actor.roles);
  const parsed = parseOp37Body(input.body);
  // Responsible professional: the authenticated user's own, or an explicit one when the user
  // has none linked (a procedure may name another responsible professional of the institution).
  const id_profesional = parsed.id_profesional ?? actor.id_profesional;
  if (id_profesional == null) {
    throw new ClinicalError('forbidden', PROFESIONAL_NO_VINCULADO);
  }
  const body = { ...parsed, id_profesional };
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.procedure.op37(
      { params: {}, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}
