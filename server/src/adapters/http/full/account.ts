import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthPrincipalDto } from '@genki/shared';
import { executeOp03, executeOp04 } from '../../../application/full/account.js';
import type { AccountRepositoryPort } from '../../../ports/full/account.js';
import type { OperationContext } from '../../../ports/full/context.js';
import { ClinicalError } from '../../../domain/clinical-error.js';
import { forbiddenError, invalidBodyError, toErrorDto } from '../errors.js';
import { paramsSchema } from '../schemas.js';

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

export function registerAccountRoutes(
  app: FastifyInstance,
  options: {
    account: AccountRepositoryPort;
    requirePrincipal: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<AuthPrincipalDto | null>;
    nowIso: () => string;
  },
): void {
  app.post('/api/auth/password', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    try {
      await executeOp03(
        options.account,
        { params: {}, query: {}, body: request.body as never },
        actorFrom(principal, options.nowIso()),
      );
      return reply.code(204).send();
    } catch (error) {
      const mapped = toErrorDto(error);
      return reply.code(mapped.status).send(mapped.body);
    }
  });

  app.post('/api/usuarios/:id/reset-password', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (
      !principal.roles.includes('administrador') &&
      !principal.roles.includes('superadministrador')
    ) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidBodyError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const result = await executeOp04(
        options.account,
        { params: { id: params.data.id }, query: {}, body: {} },
        actorFrom(principal, options.nowIso()),
      );
      return reply.code(200).send(result);
    } catch (error) {
      if (error instanceof ClinicalError) {
        const mapped = toErrorDto(error);
        return reply.code(mapped.status).send(mapped.body);
      }
      const mapped = toErrorDto(error);
      return reply.code(mapped.status).send(mapped.body);
    }
  });
}
