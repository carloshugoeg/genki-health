import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthPrincipalDto } from '@genki/shared';
import type { InstitutionAdapterRegistry } from '../../config/adapter-registry.js';
import type { AdapterSetWithFull } from '../../config/full-modules.js';
import type { OperationContext } from '../../ports/full/context.js';
import { ClinicalError } from '../../domain/clinical-error.js';
import { EconomicError } from '../../domain/full/charges.js';
import { toErrorDto } from './errors.js';

function actorFrom(
  principal: AuthPrincipalDto,
  adapters: AdapterSetWithFull,
  idempotency_key?: string,
): OperationContext {
  return {
    id_institucion: principal.id_institucion,
    id_usuario: principal.id_usuario,
    id_profesional: null,
    roles: principal.roles,
    permissions: [],
    now: adapters.clock.nowIso(),
    ...(idempotency_key ? { idempotency_key } : {}),
  };
}

function idempotencyKey(request: FastifyRequest): string | undefined {
  const raw = request.headers['idempotency-key'];
  return typeof raw === 'string' ? raw : undefined;
}

async function sendMapped(reply: FastifyReply, error: unknown) {
  if (error instanceof EconomicError) {
    const status = {
      conflict: 409,
      not_found: 404,
      reference_not_found: 404,
      forbidden: 403,
      invalid_query: 400,
    }[error.code];
    return reply.code(status).send({ error: error.code, message: error.message });
  }
  const mapped = toErrorDto(error);
  return reply.code(mapped.status).send(mapped.body);
}

export function registerLaneABRoutes(
  app: FastifyInstance,
  options: {
    registry: InstitutionAdapterRegistry;
    requirePrincipal: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<AuthPrincipalDto | null>;
  },
): void {
  const resolveSet = (principal: AuthPrincipalDto) =>
    options.registry.resolve(
      principal.institution_kind,
      principal.id_institucion,
    ) as AdapterSetWithFull;

  app.get('/api/agenda', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    try {
      const adapters = resolveSet(principal);
      if (!adapters.full?.agenda) {
        throw new ClinicalError('misconfigured', 'Módulo agenda no cableado');
      }
      const query = request.query as { fecha?: string; id_profesional?: string };
      if (typeof query.fecha !== 'string') {
        throw new ClinicalError('invalid_query', 'Parámetros de agenda inválidos');
      }
      const parsed: { fecha: string; id_profesional?: number } = { fecha: query.fecha };
      if (query.id_profesional !== undefined) {
        parsed.id_profesional = Number(query.id_profesional);
      }
      return await adapters.full.agenda.op25(
        { params: {}, query: parsed, body: {} },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.get('/api/tarifario', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    try {
      const adapters = resolveSet(principal);
      if (!adapters.full?.charges) {
        throw new ClinicalError('misconfigured', 'Módulo cargos no cableado');
      }
      const query = request.query as { page?: string; page_size?: string };
      const parsed: { page?: number; page_size?: number } = {};
      if (query.page !== undefined) parsed.page = Number(query.page);
      if (query.page_size !== undefined) parsed.page_size = Number(query.page_size);
      return await adapters.full.charges.op71(
        { params: {}, query: parsed, body: {} },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
    } catch (error) {
      return sendMapped(reply, error);
    }
  });
}
