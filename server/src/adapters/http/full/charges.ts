import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type {
  ChargesRepositoryPort,
  Op68Request,
  Op69Request,
  Op70Request,
  Op71Request,
} from '../../../ports/full/charges.js';
import type { OperationContext } from '../../../ports/full/context.js';
import { ClinicalError } from '../../../domain/clinical-error.js';
import { EconomicError } from '../../../domain/full/charges.js';
import { toErrorDto } from '../errors.js';

export function clean<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export type EconomicHttpContext = (request: FastifyRequest) => Promise<OperationContext>;

export type EconomicPluginOptions<T> = {
  context: EconomicHttpContext;
  repository?: T;
  getRepository?: (request: FastifyRequest) => T | Promise<T>;
};

export async function resolveEconomicRepository<T>(
  options: EconomicPluginOptions<T>,
  request: FastifyRequest,
): Promise<T> {
  if (options.getRepository) return options.getRepository(request);
  if (options.repository) return options.repository;
  throw new Error('economic plugin missing repository');
}

/** Trusted upstream authentication supplies context; never accept identity/permissions from body. */
export function registerEconomicRoute<T>(
  app: FastifyInstance,
  method: 'get' | 'post',
  url: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  context: EconomicHttpContext,
  invoke: (
    input: { params: { id: number }; query: T; body: T },
    ctx: OperationContext,
    request: FastifyRequest,
  ) => Promise<unknown>,
): void {
  app.route({
    method: method.toUpperCase() as 'GET' | 'POST',
    url,
    handler: async (request, reply) => {
      try {
        const ctx = await context(request);
        const parsed = schema.safeParse(method === 'get' ? request.query : request.body);
        if (!parsed.success)
          return reply.code(400).send({
            error: method === 'get' ? 'invalid_query' : 'invalid_body',
            message: 'Solicitud inválida',
          });
        const params = z
          .object({ id: z.coerce.number().int().positive().optional() })
          .safeParse(request.params);
        if (!params.success || (url.includes(':id') && !params.data.id))
          return reply
            .code(400)
            .send({ error: 'invalid_query', message: 'Identificador inválido' });
        const header = request.headers['idempotency-key'];
        if (header !== undefined && (typeof header !== 'string' || header.length > 200))
          return reply.code(400).send({ error: 'invalid_body', message: 'Clave inválida' });
        const result = await invoke(
          { params: { id: params.data.id ?? 0 }, query: parsed.data, body: parsed.data },
          { ...ctx, ...(header ? { idempotency_key: header } : {}) },
          request,
        );
        return reply.send(result);
      } catch (error) {
        if (error instanceof EconomicError)
          return reply
            .code(
              {
                conflict: 409,
                not_found: 404,
                reference_not_found: 404,
                forbidden: 403,
                invalid_query: 400,
              }[error.code],
            )
            .send({ error: error.code, message: error.message });
        if (error instanceof ClinicalError) {
          const mapped = toErrorDto(error);
          return reply.code(mapped.status).send(mapped.body);
        }
        throw error;
      }
    },
  });
}

const id = z.number().int().positive();
const txt = z.string().trim().min(1).max(500);
const pageQuery = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    page_size: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

export async function chargesPlugin(
  app: FastifyInstance,
  options: EconomicPluginOptions<ChargesRepositoryPort>,
): Promise<void> {
  registerEconomicRoute(
    app,
    'post',
    '/api/cargos',
    z
      .object({
        id_paciente: id,
        codigo_servicio: txt,
        origen: z.enum([
          'manual',
          'consulta',
          'procedimiento',
          'estancia',
          'insumo',
          'honorario',
          'examen',
        ]),
        id_consulta: id.optional(),
        id_procedimiento: id.optional(),
        id_admision: id.optional(),
        id_consumo: id.optional(),
        id_participacion: id.optional(),
        cantidad: txt,
        clave_evento: txt,
      })
      .strict(),
    options.context,
    async (input, ctx, request) => {
      const repository = await resolveEconomicRepository(options, request);
      return repository.op68(
        { params: {}, query: {}, body: clean<Op68Request['body']>(input.body) },
        ctx,
      );
    },
  );
  registerEconomicRoute(
    app,
    'get',
    '/api/pacientes/:id/cargos',
    pageQuery,
    options.context,
    async (input, ctx, request) => {
      const repository = await resolveEconomicRepository(options, request);
      return repository.op69(
        { params: input.params, query: clean<Op69Request['query']>(input.query), body: {} },
        ctx,
      );
    },
  );
  registerEconomicRoute(
    app,
    'post',
    '/api/cargos/:id/disposicion',
    z.object({ estado: z.enum(['anulado', 'cortesia']), motivo: txt }).strict(),
    options.context,
    async (input, ctx, request) => {
      const repository = await resolveEconomicRepository(options, request);
      return repository.op70(
        { params: input.params, query: {}, body: clean<Op70Request['body']>(input.body) },
        ctx,
      );
    },
  );
  registerEconomicRoute(
    app,
    'get',
    '/api/tarifario',
    pageQuery,
    options.context,
    async (input, ctx, request) => {
      const repository = await resolveEconomicRepository(options, request);
      return repository.op71(
        { params: {}, query: clean<Op71Request['query']>(input.query), body: {} },
        ctx,
      );
    },
  );
}
