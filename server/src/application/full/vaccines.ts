import type {
  DOSIS_VACUNA,
  DosisPendiente,
  DosisSchedule,
  Page,
} from '@genki/shared/full/vaccines';
import { ClinicalError } from '../../domain/clinical-error.js';
import { PROFESIONAL_NO_VINCULADO } from '../../domain/full/clinical-maintenance.js';
import {
  assertVaccineRole,
  parseDosisAplicacion,
  parsePendientesQuery,
  parseReaccion,
} from '../../domain/full/vaccines.js';
import { assertPositiveId, requireIdempotencyKey } from '../../domain/full/specialty-common.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type {
  Op43Request,
  Op44Request,
  Op45Request,
  Op47Request,
} from '../../ports/full/vaccines.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp43(
  context: FullContext,
  input: Op43Request,
  actor: OperationContext,
): Promise<DosisSchedule[]> {
  assertVaccineRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  try {
    return await context.modules.vaccines.op43(
      { params: { id }, query: {}, body: {} },
      { ...actor, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp44(
  context: FullContext,
  input: Op44Request,
  actor: OperationContext,
): Promise<DOSIS_VACUNA> {
  assertVaccineRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  const parsed = parseDosisAplicacion(input.body);
  const id_profesional = parsed.id_profesional ?? actor.id_profesional;
  if (id_profesional == null) {
    throw new ClinicalError('forbidden', PROFESIONAL_NO_VINCULADO);
  }
  const body = { ...parsed, id_profesional };
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.vaccines.op44(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp45(
  context: FullContext,
  input: Op45Request,
  actor: OperationContext,
): Promise<DOSIS_VACUNA> {
  assertVaccineRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  const body = parseReaccion(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.vaccines.op45(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp47(
  context: FullContext,
  input: Op47Request,
  actor: OperationContext,
): Promise<Page<DosisPendiente>> {
  assertVaccineRole(actor.roles);
  const today = (actor.now || context.clock.nowIso()).slice(0, 10);
  const query = parsePendientesQuery(input.query, today);
  try {
    return await context.modules.vaccines.op47(
      { params: {}, query, body: {} },
      { ...actor, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}
