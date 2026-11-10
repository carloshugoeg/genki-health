import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type {
  Op09Request,
  Op09Response,
  Op10Request,
  Op10Response,
} from '../../ports/full/patient.js';
import {
  assertPatientOp09Role,
  assertPatientOp10Role,
  parseContactoInput,
  parsePacientePatch,
} from '../../domain/full/patient.js';

export async function executeOp09(
  context: FullContext,
  input: Op09Request,
  actor: OperationContext,
): Promise<Op09Response> {
  assertPatientOp09Role(actor.roles);
  const body = parsePacientePatch(input.body, actor.now);
  return context.unitOfWork.runInTransaction(() =>
    context.modules.patient.op09({ ...input, body }, actor),
  );
}

export async function executeOp10(
  context: FullContext,
  input: Op10Request,
  actor: OperationContext,
): Promise<Op10Response> {
  assertPatientOp10Role(actor.roles);
  const body = parseContactoInput(input.body);
  return context.unitOfWork.runInTransaction(() =>
    context.modules.patient.op10({ ...input, body }, actor),
  );
}
