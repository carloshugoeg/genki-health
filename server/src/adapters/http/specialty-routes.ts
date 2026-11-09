import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthPrincipalDto, InstitutionKind } from '@genki/shared';
import { executeOp34, executeOp35 } from '../../application/full/admission.js';
import { executeOp36, executeOp37 } from '../../application/full/procedure.js';
import { executeOp38 } from '../../application/full/discharge.js';
import { executeOp59, executeOp60 } from '../../application/full/dental-session.js';
import { executeOp40, executeOp41, executeOp42 } from '../../application/full/growth.js';
import {
  executeOp43,
  executeOp44,
  executeOp45,
  executeOp47,
} from '../../application/full/vaccines.js';
import { executeOp46 } from '../../application/full/milestones.js';
import { executeOp48, executeOp49 } from '../../application/full/lab-intake.js';
import {
  executeOp50,
  executeOp51,
  executeOp52,
  executeOp53,
  executeOp54,
} from '../../application/full/lab-results.js';
import { executeOp55, executeOp56 } from '../../application/full/dental-chart.js';
import { executeOp57, executeOp58 } from '../../application/full/dental-plan.js';
import type { AdapterSet, InstitutionAdapterRegistry } from '../../config/adapter-registry.js';
import { fullModulesFromSet, type AdapterSetWithFull } from '../../config/full-modules.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import { ClinicalError } from '../../domain/clinical-error.js';
import { forbiddenError, invalidQueryError, toErrorDto } from './errors.js';
import { paramsSchema } from './schemas.js';

function hasAnyRole(principal: AuthPrincipalDto, roles: readonly string[]): boolean {
  if (principal.roles.includes('superadministrador')) return true;
  return principal.roles.some((role) => roles.includes(role));
}

function actorFrom(
  principal: AuthPrincipalDto,
  adapters: AdapterSet,
  idempotency_key?: string,
): OperationContext {
  return {
    id_institucion: principal.id_institucion,
    id_usuario: principal.id_usuario,
    id_profesional:
      principal.roles.includes('superadministrador') ||
      principal.roles.includes('medico') ||
      principal.roles.includes('enfermeria') ||
      principal.roles.includes('odontologo') ||
      principal.roles.includes('laboratorista')
        ? 1
        : null,
    roles: principal.roles,
    permissions: [],
    now: adapters.clock.nowIso(),
    ...(idempotency_key ? { idempotency_key } : {}),
  };
}

function fullContext(adapters: AdapterSetWithFull): FullContext {
  if (!adapters.full) {
    throw new ClinicalError('misconfigured', 'Módulos clínicos no cableados');
  }
  return {
    base: adapters,
    modules: fullModulesFromSet(adapters),
    unitOfWork: adapters.unitOfWork,
    clock: adapters.clock,
    ids: adapters.ids,
  };
}

async function sendMapped(reply: FastifyReply, error: unknown) {
  const mapped = toErrorDto(error);
  return reply.code(mapped.status).send(mapped.body);
}

function idempotencyKey(request: FastifyRequest): string | undefined {
  const raw = request.headers['idempotency-key'];
  return typeof raw === 'string' ? raw : undefined;
}

function requireKind(principal: AuthPrincipalDto, kinds: InstitutionKind[]): boolean {
  return kinds.includes(principal.institution_kind);
}

export function registerSpecialtyRoutes(
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

  app.get('/api/camas', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['hospital_general'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    if (!hasAnyRole(principal, ['medico', 'enfermeria', 'administrador'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const query = request.query as { id_servicio?: string };
      const parsed =
        query.id_servicio !== undefined ? { id_servicio: Number(query.id_servicio) } : {};
      return await executeOp34(
        fullContext(adapters),
        { params: {}, query: parsed, body: {} },
        actorFrom(principal, adapters),
      );
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/pacientes/:id/admisiones', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['hospital_general'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp35(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/admisiones/:id/notas', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['hospital_general'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp36(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/procedimientos', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['hospital_general'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp37(
        fullContext(adapters),
        { params: {}, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/planes/:id/sesiones', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['clinica_odontologica'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp59(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.get('/api/pacientes/:id/saldo-dental', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['clinica_odontologica'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      return await executeOp60(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: {} },
        actorFrom(principal, adapters),
      );
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/admisiones/:id/egreso', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['hospital_general'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp38(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(200).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.put('/api/pacientes/:id/perinatal', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['centro_pediatrico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp40(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(200).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/consultas/:id/mediciones', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['centro_pediatrico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp41(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.get('/api/pacientes/:id/crecimiento', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['centro_pediatrico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      return await executeOp42(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: {} },
        actorFrom(principal, adapters),
      );
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.get('/api/pacientes/:id/vacunas', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['centro_pediatrico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      return await executeOp43(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: {} },
        actorFrom(principal, adapters),
      );
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/dosis/:id/aplicacion', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['centro_pediatrico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp44(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(200).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/dosis/:id/reacciones', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['centro_pediatrico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp45(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(200).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.get('/api/vacunas/pendientes', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['centro_pediatrico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      return await executeOp47(
        fullContext(adapters),
        { params: {}, query: request.query as never, body: {} },
        actorFrom(principal, adapters),
      );
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.put('/api/pacientes/:id/hitos/:hito', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['centro_pediatrico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const raw = request.params as { id?: string; hito?: string };
    const id = Number(raw.id);
    const hito = Number(raw.hito);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(hito) || hito < 1) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp46(
        fullContext(adapters),
        { params: { id, hito }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(200).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/laboratorio/ordenes', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['laboratorio_clinico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp48(
        fullContext(adapters),
        { params: {}, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/laboratorio/ordenes/:id/muestras', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['laboratorio_clinico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp49(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/laboratorio/ordenes/:id/resultados', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['laboratorio_clinico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp50(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/laboratorio/resultados/:id/validacion', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['laboratorio_clinico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp51(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: {} },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(200).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/laboratorio/resultados/:id/comparacion', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['laboratorio_clinico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      return await executeOp52(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: {} },
        actorFrom(principal, adapters),
      );
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/laboratorio/ordenes/:id/entrega', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['laboratorio_clinico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp53(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: {} },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(200).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.get('/api/pacientes/:id/examenes', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['laboratorio_clinico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      return await executeOp54(
        fullContext(adapters),
        { params: { id: params.data.id }, query: request.query as never, body: {} },
        actorFrom(principal, adapters),
      );
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/pacientes/:id/odontogramas', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['clinica_odontologica'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp55(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.put('/api/odontogramas/:id/piezas/:numero', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['clinica_odontologica'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const raw = request.params as { id?: string; numero?: string };
    const id = Number(raw.id);
    const numero = Number(raw.numero);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(numero) || numero < 1) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp56(
        fullContext(adapters),
        { params: { id, numero }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(200).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/pacientes/:id/planes', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['clinica_odontologica'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp57(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/planes/:id/aceptacion', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!requireKind(principal, ['clinica_odontologica'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = resolve(principal);
      const result = await executeOp58(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: {} },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(200).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });
}
