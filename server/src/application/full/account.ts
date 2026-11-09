import { ClinicalError } from '../../domain/clinical-error.js';
import {
  assertAccountAdminRole,
  assertAccountSelfRole,
  parseOp03Body,
  parseOp04Params,
} from '../../domain/full/account.js';
import type { OperationContext } from '../../ports/full/context.js';
import type { AccountRepositoryPort, Op03Request, Op04Request } from '../../ports/full/account.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp03(
  account: AccountRepositoryPort,
  input: Op03Request,
  actor: OperationContext,
): Promise<void> {
  assertAccountSelfRole(actor.roles);
  const body = parseOp03Body(input.body);
  try {
    await account.op03({ params: {}, query: {}, body }, { ...actor, now: actor.now });
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp04(
  account: AccountRepositoryPort,
  input: Op04Request,
  actor: OperationContext,
): Promise<{ temporal: string }> {
  assertAccountAdminRole(actor.roles);
  const id = parseOp04Params(input.params);
  try {
    return await account.op04(
      { params: { id }, query: {}, body: {} },
      { ...actor, now: actor.now },
    );
  } catch (err) {
    rethrow(err);
  }
}
