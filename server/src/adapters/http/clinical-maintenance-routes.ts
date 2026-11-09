import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthPrincipalDto } from '@genki/shared';
import type { CerrarConsultaInput } from '@genki/shared/full/consultation';
import {
  executeAnularItemClinico,
  executeCerrarConsulta,
  executeModificarItemClinico,
} from '../../application/full/clinical-maintenance.js';
import type { InstitutionAdapterRegistry } from '../../config/adapter-registry.js';
import { fullModulesFromSet, type AdapterSetWithFull } from '../../config/full-modules.js';
import { ClinicalError } from '../../domain/clinical-error.js';
import {
  CLINICAL_MAINTENANCE_ROLES,
  parseAnulacionBody,
  parseModificacionBody,
  type ClinicalItemEntity,
} from '../../domain/full/clinical-maintenance.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import { profesionalOf } from './actor.js';
import { forbiddenError, invalidBodyError, invalidQueryError, toErrorDto } from './errors.js';
import { detalleSchema, diagnosticoSchema, paramsSchema, tratamientoSchema } from './schemas.js';

const nullableText = (n: number) => z.string().trim().min(1).max(n).nullable().optional();

/** OP-31 body: the closed-consultation composer minus the header already stored at OP-26. */
export const cierreSchema = z
  .object({
    enfermedad_actual: nullableText(2000),
    exploracion_fisica: nullableText(2000),
    plan: nullableText(2000),
    diagnosticos: z.array(diagnosticoSchema).min(1).max(10),
    tratamientos: z.array(tratamientoSchema).min(1).max(20),
    receta: z
      .object({
        observaciones: nullableText(1000),
        detalles: z.array(detalleSchema).min(1).max(20),
      })
      .strict()
      .optional(),
  })
  .strict();

function hasAnyRole(principal: AuthPrincipalDto, roles: readonly string[]): boolean {
  if (principal.roles.includes('superadministrador')) return true;
  return principal.roles.some((role) => roles.includes(role));
}

function actor(principal: AuthPrincipalDto, adapters: AdapterSetWithFull): OperationContext {
  return {
    id_institucion: principal.id_institucion,
    id_usuario: principal.id_usuario,
    id_profesional: profesionalOf(principal),
    roles: principal.roles,
    permissions: [],
    now: adapters.clock.nowIso(),
  };
}

function fullContext(adapters: AdapterSetWithFull): FullContext {
  if (!adapters.full) throw new ClinicalError('misconfigured', 'Módulos clínicos no cableados');
  return {
    base: adapters,
    modules: fullModulesFromSet(adapters),
    unitOfWork: adapters.unitOfWork,
    clock: adapters.clock,
    ids: adapters.ids,
  };
}

function toCierreInput(data: z.infer<typeof cierreSchema>): CerrarConsultaInput {
  return {
    enfermedad_actual: data.enfermedad_actual ?? null,
    exploracion_fisica: data.exploracion_fisica ?? null,
    plan: data.plan ?? null,
    diagnosticos: data.diagnosticos.map((dx) => ({
      descripcion: dx.descripcion,
      tipo: dx.tipo,
      es_principal: dx.es_principal,
      ...(dx.codigo_cie10 != null ? { codigo_cie10: dx.codigo_cie10 } : {}),
    })),
    tratamientos: data.tratamientos.map((tx) => ({
      diagnostico_index: tx.diagnostico_index,
      tipo: tx.tipo,
      descripcion: tx.descripcion,
      fecha_inicio: tx.fecha_inicio,
      estado: tx.estado,
      ...(tx.indicaciones != null ? { indicaciones: tx.indicaciones } : {}),
      ...(tx.fecha_fin_estimada != null ? { fecha_fin_estimada: tx.fecha_fin_estimada } : {}),
    })),
    ...(data.receta
      ? {
          receta: {
            detalles: data.receta.detalles.map((d) => ({
              id_medicamento: d.id_medicamento,
              dosis: d.dosis,
              via_administracion: d.via_administracion,
              frecuencia_horas: d.frecuencia_horas,
              duracion_dias: d.duracion_dias,
              cantidad: d.cantidad,
              indicaciones: d.indicaciones ?? null,
            })),
            ...(data.receta.observaciones != null
              ? { observaciones: data.receta.observaciones }
              : {}),
          },
        }
      : {}),
  };
}

const ENTITY_PATHS: ReadonlyArray<[string, ClinicalItemEntity]> = [
  ['diagnosticos', 'diagnostico'],
  ['tratamientos', 'tratamiento'],
  ['recetas', 'receta'],
];

/**
 * Mantenimiento de historiales:
 *   POST  /api/consultas/:id/cierre        close an open consultation (OP-31), atomically
 *   PATCH /api/{diagnosticos|tratamientos|recetas}/:id            audited correction
 *   POST  /api/{diagnosticos|tratamientos|recetas}/:id/anulacion  annul (status), never DELETE
 */
export function registerClinicalMaintenanceRoutes(
  app: FastifyInstance,
  options: {
    registry: InstitutionAdapterRegistry;
    requirePrincipal: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<AuthPrincipalDto | null>;
  },
): void {
  const resolve = (principal: AuthPrincipalDto) =>
    options.registry.resolve(
      principal.institution_kind,
      principal.id_institucion,
    ) as AdapterSetWithFull;

  async function guard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<{ principal: AuthPrincipalDto; id: number } | null> {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return null;
    if (!hasAnyRole(principal, CLINICAL_MAINTENANCE_ROLES)) {
      const mapped = forbiddenError();
      await reply.code(mapped.status).send(mapped.body);
      return null;
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      await reply.code(mapped.status).send(mapped.body);
      return null;
    }
    return { principal, id: params.data.id };
  }

  async function sendMapped(reply: FastifyReply, error: unknown) {
    const mapped = toErrorDto(error);
    return reply.code(mapped.status).send(mapped.body);
  }

  app.post('/api/consultas/:id/cierre', async (request, reply) => {
    const ok = await guard(request, reply);
    if (!ok) return;
    const body = cierreSchema.safeParse(request.body);
    if (!body.success) {
      const mapped = invalidBodyError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(ok.principal);
      return await executeCerrarConsulta(
        fullContext(adapters),
        { params: { id: ok.id }, body: toCierreInput(body.data) },
        actor(ok.principal, adapters),
      );
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  for (const [segment, entidad] of ENTITY_PATHS) {
    app.patch(`/api/${segment}/:id`, async (request, reply) => {
      const ok = await guard(request, reply);
      if (!ok) return;
      try {
        const body = parseModificacionBody(entidad, request.body);
        const adapters = resolve(ok.principal);
        return await executeModificarItemClinico(
          fullContext(adapters),
          { params: { id: ok.id }, body },
          actor(ok.principal, adapters),
        );
      } catch (error) {
        return sendMapped(reply, error);
      }
    });

    app.post(`/api/${segment}/:id/anulacion`, async (request, reply) => {
      const ok = await guard(request, reply);
      if (!ok) return;
      try {
        const { motivo } = parseAnulacionBody(request.body);
        const adapters = resolve(ok.principal);
        return await executeAnularItemClinico(
          fullContext(adapters),
          { params: { id: ok.id }, body: { entidad, motivo } },
          actor(ok.principal, adapters),
        );
      } catch (error) {
        return sendMapped(reply, error);
      }
    });
  }
}
