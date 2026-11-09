import {
  clean,
  registerEconomicRoute,
  resolveEconomicRepository,
  type EconomicPluginOptions,
} from './charges.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type {
  HonorariaRepositoryPort,
  Op63Request,
  Op64Request,
  Op65Request,
} from '../../../ports/full/honoraria.js';

const id = z.number().int().positive();
const txt = z.string().trim().min(1).max(500);

export async function honorariaPlugin(
  app: FastifyInstance,
  options: EconomicPluginOptions<HonorariaRepositoryPort>,
): Promise<void> {
  registerEconomicRoute(
    app,
    'post',
    '/api/participaciones',
    z
      .object({
        id_profesional: id,
        codigo_rol: txt,
        id_consulta: id.nullable().optional(),
        id_procedimiento: id.nullable().optional(),
        fecha_hora_inicio: txt,
        fecha_hora_fin: txt.nullable().optional(),
        observacion: txt.nullable().optional(),
      })
      .strict(),
    options.context,
    async (input, ctx, request) => {
      const repository = await resolveEconomicRepository(options, request);
      return repository.op63(
        { params: {}, query: {}, body: clean<Op63Request['body']>(input.body) },
        ctx,
      );
    },
  );
  registerEconomicRoute(
    app,
    'post',
    '/api/actos/honorarios',
    z.object({ id_consulta: id.optional(), id_procedimiento: id.optional() }).strict(),
    options.context,
    async (input, ctx, request) => {
      const repository = await resolveEconomicRepository(options, request);
      return repository.op64(
        { params: {}, query: {}, body: clean<Op64Request['body']>(input.body) },
        ctx,
      );
    },
  );
  registerEconomicRoute(
    app,
    'get',
    '/api/honorarios/liquidacion',
    z
      .object({
        desde: txt,
        hasta: txt,
        id_profesional: z.coerce.number().int().positive().optional(),
      })
      .strict(),
    options.context,
    async (input, ctx, request) => {
      const repository = await resolveEconomicRepository(options, request);
      return repository.op65(
        { params: {}, query: clean<Op65Request['query']>(input.query), body: {} },
        ctx,
      );
    },
  );
}
