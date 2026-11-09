import { clean, registerEconomicRoute, type EconomicHttpContext } from './charges.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type {
  InvoicingRepositoryPort,
  Op72Request,
  Op73Request,
} from '../../../ports/full/invoicing.js';
const id = z.number().int().positive();
const txt = z.string().trim().min(1).max(500);
export async function invoicingPlugin(
  app: FastifyInstance,
  options: { repository: InvoicingRepositoryPort; context: EconomicHttpContext },
): Promise<void> {
  registerEconomicRoute(
    app,
    'post',
    '/api/pacientes/:id/facturas/preview',
    z.object({ cargo_ids: z.array(id).min(1).max(100) }).strict(),
    options.context,
    async (input, ctx) =>
      options.repository.op72(
        { params: input.params, query: {}, body: clean<Op72Request['body']>(input.body) },
        ctx,
      ),
  );
  registerEconomicRoute(
    app,
    'post',
    '/api/pacientes/:id/facturas',
    z
      .object({
        cargo_ids: z.array(id).min(1).max(100),
        serie: txt,
        nombre_receptor: txt,
        nit_receptor: txt,
        descuento: txt.optional(),
        cobertura_seguro: txt.optional(),
        preview_hash: txt,
      })
      .strict(),
    options.context,
    async (input, ctx) =>
      options.repository.op73(
        { params: input.params, query: {}, body: clean<Op73Request['body']>(input.body) },
        ctx,
      ),
  );
}
