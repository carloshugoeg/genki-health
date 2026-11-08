import { ClinicalError } from '../../domain/clinical-error.js';
import {
  assertAgendaRole,
  assertAgendaViewRole,
  parseOp20Query,
  parseOp21Body,
  parseOp22Body,
  parseOp22Params,
  parseOp23Body,
  parseOp23Params,
  parseOp24Params,
  parseOp25Query,
} from '../../domain/full/agenda.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type {
  Op20Request,
  Op20Response,
  Op21Request,
  Op21Response,
  Op22Request,
  Op22Response,
  Op23Request,
  Op23Response,
  Op24Request,
  Op24Response,
  Op25Request,
  Op25Response,
} from '../../ports/full/agenda.js';

function assertEmptyRecord(
  value: Record<string, unknown>,
  code: 'invalid_query' | 'invalid_body',
): void {
  if (Object.keys(value).length > 0) {
    throw new ClinicalError(code, 'Envelope inesperado');
  }
}

export async function executeOp20(
  context: FullContext,
  input: Op20Request,
  actor: OperationContext,
): Promise<Op20Response> {
  assertAgendaRole(actor.roles);
  assertEmptyRecord(input.params as Record<string, unknown>, 'invalid_query');
  assertEmptyRecord(input.body as Record<string, unknown>, 'invalid_query');
  parseOp20Query(input.query as Record<string, unknown>);
  return context.unitOfWork.runInTransaction(async () => context.modules.agenda.op20(input, actor));
}

export async function executeOp21(
  context: FullContext,
  input: Op21Request,
  actor: OperationContext,
): Promise<Op21Response> {
  assertAgendaRole(actor.roles);
  assertEmptyRecord(input.params as Record<string, unknown>, 'invalid_body');
  assertEmptyRecord(input.query as Record<string, unknown>, 'invalid_body');
  parseOp21Body(input.body as Record<string, unknown>);
  return context.unitOfWork.runInTransaction(async () => context.modules.agenda.op21(input, actor));
}

export async function executeOp22(
  context: FullContext,
  input: Op22Request,
  actor: OperationContext,
): Promise<Op22Response> {
  assertAgendaRole(actor.roles);
  assertEmptyRecord(input.query as Record<string, unknown>, 'invalid_body');
  parseOp22Params(input.params as Record<string, unknown>);
  parseOp22Body(input.body as Record<string, unknown>);
  return context.unitOfWork.runInTransaction(async () => context.modules.agenda.op22(input, actor));
}

export async function executeOp23(
  context: FullContext,
  input: Op23Request,
  actor: OperationContext,
): Promise<Op23Response> {
  assertAgendaRole(actor.roles);
  assertEmptyRecord(input.query as Record<string, unknown>, 'invalid_body');
  parseOp23Params(input.params as Record<string, unknown>);
  parseOp23Body(input.body as Record<string, unknown>);
  return context.unitOfWork.runInTransaction(async () => context.modules.agenda.op23(input, actor));
}

export async function executeOp24(
  context: FullContext,
  input: Op24Request,
  actor: OperationContext,
): Promise<Op24Response> {
  assertAgendaRole(actor.roles);
  assertEmptyRecord(input.query as Record<string, unknown>, 'invalid_body');
  assertEmptyRecord(input.body as Record<string, unknown>, 'invalid_body');
  parseOp24Params(input.params as Record<string, unknown>);
  return context.unitOfWork.runInTransaction(async () => context.modules.agenda.op24(input, actor));
}

export async function executeOp25(
  context: FullContext,
  input: Op25Request,
  actor: OperationContext,
): Promise<Op25Response> {
  assertAgendaViewRole(actor.roles);
  assertEmptyRecord(input.params as Record<string, unknown>, 'invalid_query');
  assertEmptyRecord(input.body as Record<string, unknown>, 'invalid_query');
  parseOp25Query(input.query as Record<string, unknown>);
  return context.unitOfWork.runInTransaction(async () => context.modules.agenda.op25(input, actor));
}
