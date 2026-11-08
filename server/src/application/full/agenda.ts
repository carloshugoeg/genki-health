import { ClinicalError } from '../../domain/clinical-error.js';
import { assertAgendaRole, parseOp20Query, parseOp21Body } from '../../domain/full/agenda.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type {
  Op20Request,
  Op20Response,
  Op21Request,
  Op21Response,
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
