import type { ORDEN_EXAMEN, MUESTRA } from '@genki/shared/full/lab-intake';
import { ClinicalError } from '../../domain/clinical-error.js';
import { assertLabIntakeRole, parseLabOrder, parseMuestra } from '../../domain/full/lab-intake.js';
import { assertPositiveId, requireIdempotencyKey } from '../../domain/full/specialty-common.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { Op48Request, Op49Request } from '../../ports/full/lab-intake.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp48(
  context: FullContext,
  input: Op48Request,
  actor: OperationContext,
): Promise<ORDEN_EXAMEN> {
  assertLabIntakeRole(actor.roles);
  const body = parseLabOrder(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.labIntake.op48(
      { params: {}, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp49(
  context: FullContext,
  input: Op49Request,
  actor: OperationContext,
): Promise<MUESTRA> {
  assertLabIntakeRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  const body = parseMuestra(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.labIntake.op49(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}
