import type { RESULTADO, ResultadoFlags, LabHistory, Page } from '@genki/shared/full/lab-results';
import type { JsonValue, ORDEN_EXAMEN } from '@genki/shared/full/schema';
import { ClinicalError } from '../../domain/clinical-error.js';
import { assertLabResultRole, parseResultado } from '../../domain/full/lab-results.js';
import { assertPositiveId, requireIdempotencyKey } from '../../domain/full/specialty-common.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type {
  Op50Request,
  Op51Request,
  Op52Request,
  Op53Request,
  Op54Request,
} from '../../ports/full/lab-results.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp50(
  context: FullContext,
  input: Op50Request,
  actor: OperationContext,
): Promise<RESULTADO> {
  assertLabResultRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  const parsed = parseResultado(input.body);
  const body = {
    codigo_examen: parsed.codigo_examen,
    id_muestra: parsed.id_muestra,
    datos: parsed.datos as JsonValue,
    ...(parsed.observaciones !== undefined ? { observaciones: parsed.observaciones } : {}),
  };
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.labResults.op50(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp51(
  context: FullContext,
  input: Op51Request,
  actor: OperationContext,
): Promise<RESULTADO> {
  assertLabResultRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.labResults.op51(
      { params: { id }, query: {}, body: {} },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp52(
  context: FullContext,
  input: Op52Request,
  actor: OperationContext,
): Promise<ResultadoFlags> {
  assertLabResultRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  try {
    return await context.modules.labResults.op52(
      { params: { id }, query: {}, body: {} },
      { ...actor, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp53(
  context: FullContext,
  input: Op53Request,
  actor: OperationContext,
): Promise<ORDEN_EXAMEN> {
  assertLabResultRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.labResults.op53(
      { params: { id }, query: {}, body: {} },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp54(
  context: FullContext,
  input: Op54Request,
  actor: OperationContext,
): Promise<Page<LabHistory>> {
  assertLabResultRole(actor.roles);
  const id = assertPositiveId(input.params.id);
  try {
    return await context.modules.labResults.op54(
      { params: { id }, query: input.query, body: {} },
      { ...actor, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}
