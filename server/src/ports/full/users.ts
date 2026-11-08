/** Port declarations for module `users` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  UsuarioAdminInput,
  UsuarioAdminResult,
  AuditQuery,
  BitacoraSafe,
  Page,
} from '@genki/shared/full/users';

export type Op05Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: UsuarioAdminInput;
};
export type Op05Response = UsuarioAdminResult;

export type Op06Request = {
  params: Record<string, never>;
  query: AuditQuery;
  body: Record<string, never>;
};
export type Op06Response = Page<BitacoraSafe>;

export interface UsersRepositoryPort {
  op05(input: Op05Request, context: OperationContext): Promise<Op05Response>;
  op06(input: Op06Request, context: OperationContext): Promise<Op06Response>;
}
