import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AgendaRepositoryPort } from '../../../ports/full/agenda.js';
import type { OperationContext } from '../../../ports/full/context.js';
import { ClinicalError } from '../../../domain/clinical-error.js';
import { toErrorDto } from '../errors.js';

export interface AgendaHttpOptions {
  /** Trusted host hook: verify existing identity and select institution repository. */
  resolve: (
    request: FastifyRequest,
  ) => Promise<{ repository: AgendaRepositoryPort; context: OperationContext }>;
}
const id = z.number().int().positive().max(2147483647);
const queryId = z.coerce.number().int().positive().max(2147483647);
const dateTime = z.string().datetime({ offset: true });
const booking = z
  .object({
    id_paciente: id,
    id_profesional: id,
    id_especialidad: id.nullable().optional(),
    fecha_hora: dateTime,
    duracion_minutos: z.number().int().positive().max(32767),
    motivo: z.string().max(200).nullable().optional(),
  })
  .strict();
const params = z.object({ id: queryId }).strict();
function parse<T>(schema: z.ZodType<T>, value: unknown, code: 'invalid_query' | 'invalid_body'): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ClinicalError(code, 'Solicitud de agenda inválida');
  return result.data;
}
/** Standalone plugin; no global mounting, auth changes or default memory binding. */
export const agendaPlugin: FastifyPluginAsync<AgendaHttpOptions> = async (app, options) => {
  app.setErrorHandler((error, _request, reply) => {
    const mapped = toErrorDto(error);
    return reply.code(mapped.status).send(mapped.body);
  });
  app.get('/api/agenda/disponibilidad', async (request) => {
    const { repository, context } = await options.resolve(request);
    const query = parse(
      z.object({ id_profesional: queryId, desde: dateTime, hasta: dateTime }).strict(),
      request.query,
      'invalid_query',
    );
    return repository.op20({ params: {}, query, body: {} }, context);
  });
  app.post('/api/citas', async (request, reply) => {
    const { repository, context } = await options.resolve(request);
    const body = parse(booking, request.body, 'invalid_body');
    return reply.code(201).send(
      await repository.op21(
        {
          params: {},
          query: {},
          body: {
            ...body,
            id_especialidad: body.id_especialidad ?? null,
            motivo: body.motivo ?? null,
          },
        },
        context,
      ),
    );
  });
  app.post('/api/citas/:id/reprogramacion', async (request) => {
    const { repository, context } = await options.resolve(request);
    return repository.op22(
      {
        params: parse(params, request.params, 'invalid_query'),
        query: {},
        body: parse(
          z
            .object({
              fecha_hora: dateTime,
              duracion_minutos: z.number().int().positive().max(32767),
            })
            .strict(),
          request.body,
          'invalid_body',
        ),
      },
      context,
    );
  });
  app.post('/api/citas/:id/cancelacion', async (request) => {
    const { repository, context } = await options.resolve(request);
    return repository.op23(
      {
        params: parse(params, request.params, 'invalid_query'),
        query: {},
        body: parse(
          z.object({ motivo: z.string().trim().min(1).max(4000) }).strict(),
          request.body,
          'invalid_body',
        ),
      },
      context,
    );
  });
  app.post('/api/citas/:id/llegada', async (request) => {
    const { repository, context } = await options.resolve(request);
    parse(z.object({}).strict(), request.body ?? {}, 'invalid_body');
    return repository.op24(
      { params: parse(params, request.params, 'invalid_query'), query: {}, body: {} },
      context,
    );
  });
  app.get('/api/agenda', async (request) => {
    const { repository, context } = await options.resolve(request);
    const parsed = parse(
      z
        .object({
          fecha: z.string().regex(/^\d{4}-\d\d-\d\d$/),
          id_profesional: queryId.optional(),
        })
        .strict(),
      request.query,
      'invalid_query',
    );
    const query = {
      fecha: parsed.fecha,
      ...(parsed.id_profesional !== undefined ? { id_profesional: parsed.id_profesional } : {}),
    };
    return repository.op25({ params: {}, query, body: {} }, context);
  });
};
