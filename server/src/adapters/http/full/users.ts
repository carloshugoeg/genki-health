import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthPrincipalDto } from '@genki/shared';
import { executeOp05, executeOp06 } from '../../../application/full/users.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type { UsersRepositoryPort } from '../../../ports/full/users.js';
import { forbiddenError, toErrorDto } from '../errors.js';

function actorFrom(principal: AuthPrincipalDto, now: string): OperationContext {
  return {
    id_institucion: principal.id_institucion,
    id_usuario: principal.id_usuario,
    id_profesional: null,
    roles: principal.roles,
    permissions: [],
    now,
  };
}

function hasAdmin(principal: AuthPrincipalDto): boolean {
  return (
    principal.roles.includes('superadministrador') || principal.roles.includes('administrador')
  );
}

function hasAudit(principal: AuthPrincipalDto): boolean {
  return hasAdmin(principal) || principal.roles.includes('auditor');
}

export function registerUsersRoutes(
  app: FastifyInstance,
  options: {
    users: UsersRepositoryPort;
    requirePrincipal: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<AuthPrincipalDto | null>;
    nowIso: () => string;
  },
): void {
  app.post('/api/usuarios', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!hasAdmin(principal)) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const result = await executeOp05(
        options.users,
        { params: {}, query: {}, body: request.body as never },
        actorFrom(principal, options.nowIso()),
      );
      return reply.code(200).send(result);
    } catch (error) {
      const mapped = toErrorDto(error);
      return reply.code(mapped.status).send(mapped.body);
    }
  });

  app.get('/api/bitacora', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!hasAudit(principal)) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const result = await executeOp06(
        options.users,
        { params: {}, query: request.query as never, body: {} },
        actorFrom(principal, options.nowIso()),
      );
      return reply.code(200).send(result);
    } catch (error) {
      const mapped = toErrorDto(error);
      return reply.code(mapped.status).send(mapped.body);
    }
  });
}
