import type { Page } from '@genki/shared/full/schema';
import type { BitacoraSafe, UsuarioAdminResult } from '@genki/shared/full/users';
import { ClinicalError } from '../../domain/clinical-error.js';
import {
  assertUsersAdminRole,
  assertUsersAuditRole,
  parseAuditQuery,
  parseUsuarioAdminInput,
} from '../../domain/full/users.js';
import type { OperationContext } from '../../ports/full/context.js';
import type { Op05Request, Op06Request, UsersRepositoryPort } from '../../ports/full/users.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

export async function executeOp05(
  users: UsersRepositoryPort,
  input: Op05Request,
  actor: OperationContext,
): Promise<UsuarioAdminResult> {
  assertUsersAdminRole(actor.roles);
  const body = parseUsuarioAdminInput(input.body);
  try {
    return await users.op05({ params: {}, query: {}, body }, { ...actor, now: actor.now });
  } catch (err) {
    rethrow(err);
  }
}

export async function executeOp06(
  users: UsersRepositoryPort,
  input: Op06Request,
  actor: OperationContext,
): Promise<Page<BitacoraSafe>> {
  assertUsersAuditRole(actor.roles);
  const query = parseAuditQuery(input.query as Record<string, unknown>);
  try {
    return await users.op06({ params: {}, query, body: {} }, { ...actor, now: actor.now });
  } catch (err) {
    rethrow(err);
  }
}
