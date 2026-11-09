import {
  clean,
  registerEconomicRoute,
  resolveEconomicRepository,
  type EconomicPluginOptions,
} from './charges.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type {
  InventoryRepositoryPort,
  Op66Request,
  Op67Request,
} from '../../../ports/full/inventory.js';

const id = z.number().int().positive();
const txt = z.string().trim().min(1).max(500);
const pageQuery = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    page_size: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

export async function inventoryPlugin(
  app: FastifyInstance,
  options: EconomicPluginOptions<InventoryRepositoryPort>,
): Promise<void> {
  registerEconomicRoute(
    app,
    'post',
    '/api/consumos',
    z
      .object({
        id_paciente: id,
        consumo: z
          .object({
            id_insumo: id,
            id_admision: id.nullable().optional(),
            id_procedimiento: id.nullable().optional(),
            id_consulta: id.nullable().optional(),
            id_profesional_registra: id,
            cantidad: id,
            lote: txt.nullable().optional(),
          })
          .strict(),
      })
      .strict(),
    options.context,
    async (input, ctx, request) => {
      const repository = await resolveEconomicRepository(options, request);
      return repository.op66(
        { params: {}, query: {}, body: clean<Op66Request['body']>(input.body) },
        ctx,
      );
    },
  );
  registerEconomicRoute(
    app,
    'get',
    '/api/insumos',
    pageQuery.extend({
      bajo_stock: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional(),
    }),
    options.context,
    async (input, ctx, request) => {
      const repository = await resolveEconomicRepository(options, request);
      return repository.op67(
        { params: {}, query: clean<Op67Request['query']>(input.query), body: {} },
        ctx,
      );
    },
  );
}
