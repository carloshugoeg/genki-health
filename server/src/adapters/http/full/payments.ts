import { clean, registerEconomicRoute, type EconomicHttpContext } from './charges.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type {
  PaymentsRepositoryPort,
  Op74Request,
  Op75Request,
  Op76Request,
  Op77Request,
} from '../../../ports/full/payments.js';
const txt = z.string().trim().min(1).max(500);
const pageQuery = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    page_size: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();
export async function paymentsPlugin(
  app: FastifyInstance,
  options: { repository: PaymentsRepositoryPort; context: EconomicHttpContext },
): Promise<void> {
  registerEconomicRoute(
    app,
    'post',
    '/api/facturas/:id/pagos',
    z
      .object({
        monto: txt,
        metodo: z.enum(['efectivo', 'tarjeta', 'transferencia', 'seguro']),
        referencia: txt.optional(),
      })
      .strict(),
    options.context,
    async (input, ctx) =>
      options.repository.op74(
        { params: input.params, query: {}, body: clean<Op74Request['body']>(input.body) },
        ctx,
      ),
  );
  registerEconomicRoute(
    app,
    'post',
    '/api/facturas/:id/anulacion',
    z.object({ motivo: txt }).strict(),
    options.context,
    async (input, ctx) =>
      options.repository.op75(
        { params: input.params, query: {}, body: clean<Op75Request['body']>(input.body) },
        ctx,
      ),
  );
  registerEconomicRoute(
    app,
    'get',
    '/api/pacientes/:id/cuenta',
    pageQuery,
    options.context,
    async (input, ctx) =>
      options.repository.op76(
        { params: input.params, query: clean<Op76Request['query']>(input.query), body: {} },
        ctx,
      ),
  );
  registerEconomicRoute(
    app,
    'get',
    '/api/caja/cierre',
    z.object({ fecha: txt }).strict(),
    options.context,
    async (input, ctx) =>
      options.repository.op77(
        { params: {}, query: clean<Op77Request['query']>(input.query), body: {} },
        ctx,
      ),
  );
}
