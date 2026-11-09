import { clean, registerEconomicRoute, type EconomicHttpContext } from './charges.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type {
  PersonnelRepositoryPort,
  Op61Request,
  Op62Request,
} from '../../../ports/full/personnel.js';
const id = z.number().int().positive();
const txt = z.string().trim().min(1).max(500);
export async function personnelPlugin(
  app: FastifyInstance,
  options: { repository: PersonnelRepositoryPort; context: EconomicHttpContext },
): Promise<void> {
  registerEconomicRoute(
    app,
    'post',
    '/api/personal',
    z
      .object({
        action: z.enum(['create', 'update', 'deactivate']),
        id_profesional: id.optional(),
        nombres: txt.optional(),
        apellidos: txt.optional(),
        id_especialidad: id.nullable().optional(),
        numero_colegiado: txt.nullable().optional(),
        telefono: txt.nullable().optional(),
        correo: txt.nullable().optional(),
        id_tipo_personal: id.optional(),
        modalidad_contrato: z.enum(['planilla', 'honorarios', 'externo']).optional(),
        fecha_ingreso: txt.optional(),
      })
      .strict(),
    options.context,
    async (input, ctx) =>
      options.repository.op61(
        { params: {}, query: {}, body: clean<Op61Request['body']>(input.body) },
        ctx,
      ),
  );
  registerEconomicRoute(
    app,
    'post',
    '/api/personal/:id/tarifas',
    z
      .object({
        codigo_servicio: txt,
        modalidad: z.enum(['fijo', 'porcentaje']),
        monto_fijo: txt.nullable().optional(),
        porcentaje: txt.nullable().optional(),
        vigente_desde: txt,
        vigente_hasta: txt.nullable().optional(),
      })
      .strict(),
    options.context,
    async (input, ctx) =>
      options.repository.op62(
        { params: input.params, query: {}, body: clean<Op62Request['body']>(input.body) },
        ctx,
      ),
  );
}
