import type { ExpedienteDto } from '@genki/shared';
import type { FichaCompleta } from '@genki/shared/full/patient';
import type { ALERGIA, ANTECEDENTE } from '@genki/shared/full/record';
import { ClinicalError } from '../../domain/clinical-error.js';
import {
  assertRecordArchiveRole,
  assertRecordClinicalRole,
  assertRecordReactivateRole,
  parseAlergiaInput,
  parseAntecedenteInput,
  parseArchiveInput,
  parseOp12Params,
  parseOp15Params,
  parseOp16Params,
  parseOp18Params,
  parseOp19Params,
  parseReactivateInput,
  requireIdempotencyKey,
} from '../../domain/full/record.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type {
  Op12Request,
  Op15Request,
  Op16Request,
  Op18Request,
  Op19Request,
} from '../../ports/full/record.js';

function rethrowRecordFailure(err: unknown): never {
  if (err instanceof ClinicalError) {
    throw err;
  }
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (code === 'internal_error') {
      throw new ClinicalError('internal_error', 'Error interno');
    }
    if (code === 'store_unavailable') {
      throw new ClinicalError('store_unavailable', 'Almacenamiento no disponible');
    }
  }
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp12(
  context: FullContext,
  input: Op12Request,
  actor: OperationContext,
): Promise<FichaCompleta> {
  assertRecordClinicalRole(actor.roles);
  const id = parseOp12Params(input.params, input.query as Record<string, unknown>);
  try {
    return await context.modules.record.op12(
      { params: { id }, query: {}, body: {} },
      { ...actor, now: actor.now },
    );
  } catch (err) {
    rethrowRecordFailure(err);
  }
}

export async function executeOp15(
  context: FullContext,
  input: Op15Request,
  actor: OperationContext,
): Promise<ANTECEDENTE> {
  assertRecordClinicalRole(actor.roles);
  const id = parseOp15Params(input.params);
  const body = parseAntecedenteInput(input.body, actor.now);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.record.op15(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrowRecordFailure(err);
  }
}

export async function executeOp16(
  context: FullContext,
  input: Op16Request,
  actor: OperationContext,
): Promise<ALERGIA> {
  assertRecordClinicalRole(actor.roles);
  const id = parseOp16Params(input.params);
  const body = parseAlergiaInput(input.body, actor.now);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.record.op16(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrowRecordFailure(err);
  }
}

export async function executeOp18(
  context: FullContext,
  input: Op18Request,
  actor: OperationContext,
): Promise<ExpedienteDto> {
  assertRecordArchiveRole(actor.roles);
  const id = parseOp18Params(input.params);
  const body = parseArchiveInput(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.record.op18(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrowRecordFailure(err);
  }
}

export async function executeOp19(
  context: FullContext,
  input: Op19Request,
  actor: OperationContext,
): Promise<ExpedienteDto> {
  assertRecordReactivateRole(actor.roles);
  const id = parseOp19Params(input.params);
  const body = parseReactivateInput(input.body);
  const idempotency_key = requireIdempotencyKey(actor.idempotency_key);
  try {
    return await context.modules.record.op19(
      { params: { id }, query: {}, body },
      { ...actor, idempotency_key, now: actor.now },
    );
  } catch (err) {
    rethrowRecordFailure(err);
  }
}
