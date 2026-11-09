import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  asPacienteId,
  type AuthPrincipalDto,
  type CloseConsultaRequest,
  type InstitutionKind,
  type LoginRequestDto,
  type RegisterPacienteRequest,
} from '@genki/shared';
import { archiveExpediente } from '../../application/archive-expediente.js';
import { closeConsulta } from '../../application/close-consulta.js';
import { getHistorial } from '../../application/get-historial.js';
import { listPacientes } from '../../application/list-pacientes.js';
import { registerPaciente } from '../../application/register-paciente.js';
import type { InstitutionAdapterRegistry } from '../../config/adapter-registry.js';
import { AuthError, isInstitutionKind, type AuthPort } from '../../ports/index.js';
import {
  forbiddenError,
  invalidBodyError,
  invalidQueryError,
  notFoundEnvelope,
  toErrorDto,
} from './errors.js';
import { archiveViaOp18, registerFullClinicalRoutes } from './full-routes.js';
import { registerAccountRoutes } from './full/account.js';
import { registerUsersRoutes } from './full/users.js';
import { registerLaneABRoutes } from './lane-ab-routes.js';
import { registerSpecialtyRoutes } from './specialty-routes.js';
import { createProfesionalResolver } from './actor.js';
import { registerClinicalMaintenanceRoutes } from './clinical-maintenance-routes.js';
import {
  archiveSchema,
  closeSchema,
  paramsSchema,
  registerSchema,
  searchSchema,
} from './schemas.js';
import type { AdapterSetWithFull } from '../../config/full-modules.js';
import type { AccountRepositoryPort } from '../../ports/full/account.js';
import type { UsersRepositoryPort } from '../../ports/full/users.js';

export interface HttpAppOptions {
  registry: InstitutionAdapterRegistry;
  auth: AuthPort;
  account?: AccountRepositoryPort;
  users?: UsersRepositoryPort;
  nowIso?: () => string;
}

declare module 'fastify' {
  interface FastifyRequest {
    principal?: AuthPrincipalDto;
  }
}

const BODY_LIMIT_BYTES = 256 * 1024;

function bearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
}

function hasAnyRole(principal: AuthPrincipalDto, roles: readonly string[]): boolean {
  if (principal.roles.includes('superadministrador')) {
    return true;
  }
  return principal.roles.some((role) => roles.includes(role));
}

function toRegisterInput(data: ReturnType<typeof registerSchema.parse>): RegisterPacienteRequest {
  const responsables = data.responsables?.map((row) => ({
    tipo_documento: row.tipo_documento,
    numero_documento: row.numero_documento,
    nombre_completo: row.nombre_completo,
    parentesco: row.parentesco,
    telefono: row.telefono,
    es_principal: row.es_principal,
    ...(row.correo !== undefined ? { correo: row.correo } : {}),
    ...(row.direccion !== undefined ? { direccion: row.direccion } : {}),
  }));
  return {
    tipo_documento: data.tipo_documento,
    numero_documento: data.numero_documento,
    primer_nombre: data.primer_nombre,
    primer_apellido: data.primer_apellido,
    fecha_nacimiento: data.fecha_nacimiento,
    sexo: data.sexo,
    ...(data.segundo_nombre !== undefined ? { segundo_nombre: data.segundo_nombre } : {}),
    ...(data.segundo_apellido !== undefined ? { segundo_apellido: data.segundo_apellido } : {}),
    ...(data.tipo_sangre !== undefined ? { tipo_sangre: data.tipo_sangre } : {}),
    ...(data.telefono !== undefined ? { telefono: data.telefono } : {}),
    ...(data.correo !== undefined ? { correo: data.correo } : {}),
    ...(data.direccion !== undefined ? { direccion: data.direccion } : {}),
    ...(data.id_municipio !== undefined ? { id_municipio: data.id_municipio } : {}),
    ...(responsables !== undefined ? { responsables } : {}),
  };
}

function toCloseInput(data: ReturnType<typeof closeSchema.parse>): CloseConsultaRequest {
  return {
    id_profesional: data.id_profesional,
    fecha_hora_inicio: data.fecha_hora_inicio,
    tipo: data.tipo,
    motivo_consulta: data.motivo_consulta,
    diagnosticos: data.diagnosticos.map((dx) => ({
      descripcion: dx.descripcion,
      tipo: dx.tipo,
      es_principal: dx.es_principal,
      ...(dx.codigo_cie10 !== undefined ? { codigo_cie10: dx.codigo_cie10 } : {}),
    })),
    tratamientos: data.tratamientos.map((tx) => ({
      diagnostico_index: tx.diagnostico_index,
      tipo: tx.tipo,
      descripcion: tx.descripcion,
      fecha_inicio: tx.fecha_inicio,
      estado: tx.estado,
      ...(tx.indicaciones !== undefined ? { indicaciones: tx.indicaciones } : {}),
      ...(tx.fecha_fin_estimada !== undefined ? { fecha_fin_estimada: tx.fecha_fin_estimada } : {}),
    })),
    ...(data.enfermedad_actual !== undefined ? { enfermedad_actual: data.enfermedad_actual } : {}),
    ...(data.exploracion_fisica !== undefined
      ? { exploracion_fisica: data.exploracion_fisica }
      : {}),
    ...(data.plan !== undefined ? { plan: data.plan } : {}),
    ...(data.receta !== undefined
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
            ...(data.receta.observaciones !== undefined
              ? { observaciones: data.receta.observaciones }
              : {}),
          },
        }
      : {}),
  };
}

async function sendMapped(reply: FastifyReply, error: unknown) {
  const mapped = toErrorDto(error);
  return reply.code(mapped.status).send(mapped.body);
}

export function buildHttpApp(options: HttpAppOptions) {
  const app = Fastify({ logger: false, bodyLimit: BODY_LIMIT_BYTES });

  app.setNotFoundHandler(async (_request, reply) => {
    return reply.code(404).send(notFoundEnvelope());
  });

  app.setErrorHandler(async (error, _request, reply) => {
    return sendMapped(reply, error);
  });

  // USUARIO.id_profesional for attribution (JWT claims unchanged); cached per user for 60 s.
  const profesionales = createProfesionalResolver(
    options.users?.profesionalDeUsuario
      ? (id_usuario) => options.users!.profesionalDeUsuario!(id_usuario)
      : undefined,
    {
      superadminFallback: async (principal) => {
        const adapters = options.registry.resolve(
          principal.institution_kind,
          principal.id_institucion,
        );
        const { profesionales: rows } = await adapters.catalogos.list();
        const ids = rows.map((row) => row.id_profesional).sort((a, b) => a - b);
        return ids[0] ?? null;
      },
    },
  );

  async function requirePrincipal(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<AuthPrincipalDto | null> {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      await reply
        .code(401)
        .send({ error: 'missing_bearer', message: 'Authorization Bearer required' });
      return null;
    }
    try {
      const principal = await options.auth.verifyAccessToken(token);
      await profesionales.attach(principal);
      request.principal = principal;
      return principal;
    } catch (error) {
      if (error instanceof AuthError) {
        await sendMapped(reply, error);
        return null;
      }
      throw error;
    }
  }

  app.get('/health', async () => ({ ok: true, phase: 'e2-01-auth' }));

  app.get('/api/auth/institutions', async () => ({
    institutions: [
      { kind: 'hospital_general', nombre: 'Hospital general', motor: 'postgres' },
      { kind: 'centro_pediatrico', nombre: 'Centro médico pediátrico', motor: 'mysql' },
      { kind: 'laboratorio_clinico', nombre: 'Laboratorio clínico', motor: 'mongodb' },
      { kind: 'clinica_odontologica', nombre: 'Clínica odontológica', motor: 'firebase' },
    ],
  }));

  app.post<{ Body: LoginRequestDto }>('/api/auth/login', async (request, reply) => {
    const body = request.body;
    if (
      !body ||
      typeof body.email !== 'string' ||
      typeof body.password !== 'string' ||
      typeof body.institution_kind !== 'string' ||
      !isInstitutionKind(body.institution_kind)
    ) {
      const mapped = invalidBodyError();
      return reply.code(mapped.status).send(mapped.body);
    }

    try {
      const tokens = await options.auth.login({
        email: body.email,
        password: body.password,
        institution_kind: body.institution_kind,
      });
      return reply.code(200).send(tokens);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post<{ Body: { refresh_token?: string } }>('/api/auth/refresh', async (request, reply) => {
    const refresh_token = request.body?.refresh_token;
    if (!refresh_token || typeof refresh_token !== 'string') {
      const mapped = invalidBodyError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const tokens = await options.auth.refresh(refresh_token);
      return reply.code(200).send(tokens);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post<{ Body: { refresh_token?: string } }>('/api/auth/logout', async (request, reply) => {
    const refresh_token = request.body?.refresh_token;
    if (!refresh_token || typeof refresh_token !== 'string') {
      return reply.code(400).send({ error: 'invalid_body', message: 'refresh_token is required' });
    }
    try {
      await options.auth.logout(refresh_token);
      return reply.code(204).send();
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.get('/api/auth/me', async (request, reply) => {
    const principal = await requirePrincipal(request, reply);
    if (!principal) {
      return;
    }
    return principal;
  });

  app.post<{ Body: { institution_kind?: string; refresh_token?: string } }>(
    '/api/auth/select-institution',
    async (request, reply) => {
      const principal = await requirePrincipal(request, reply);
      if (!principal) {
        return;
      }
      const body = request.body;
      if (
        !body ||
        typeof body.institution_kind !== 'string' ||
        !isInstitutionKind(body.institution_kind) ||
        typeof body.refresh_token !== 'string'
      ) {
        const mapped = invalidBodyError();
        return reply.code(mapped.status).send(mapped.body);
      }
      const token = bearerToken(request.headers.authorization);
      if (!token) {
        return reply
          .code(401)
          .send({ error: 'missing_bearer', message: 'Authorization Bearer required' });
      }
      try {
        const tokens = await options.auth.selectInstitution(
          token,
          body.refresh_token,
          body.institution_kind,
        );
        return reply.code(200).send(tokens);
      } catch (error) {
        return sendMapped(reply, error);
      }
    },
  );

  app.get('/api/catalogos', async (request, reply) => {
    const principal = await requirePrincipal(request, reply);
    if (!principal) {
      return;
    }
    try {
      const adapters = options.registry.resolve(
        principal.institution_kind,
        principal.id_institucion,
      );
      return adapters.catalogos.list();
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/pacientes', async (request, reply) => {
    const principal = await requirePrincipal(request, reply);
    if (!principal) {
      return;
    }
    if (!hasAnyRole(principal, ['administrador', 'recepcion'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      const mapped = invalidBodyError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = options.registry.resolve(
        principal.institution_kind,
        principal.id_institucion,
      );
      const result = await registerPaciente(adapters.pacientes, toRegisterInput(parsed.data));
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.get('/api/pacientes', async (request, reply) => {
    const principal = await requirePrincipal(request, reply);
    if (!principal) {
      return;
    }
    const parsed = searchSchema.safeParse(request.query);
    if (!parsed.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = options.registry.resolve(
        principal.institution_kind,
        principal.id_institucion,
      );
      return listPacientes(adapters.pacientes, parsed.data);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.get('/api/pacientes/:id', async (request, reply) => {
    const principal = await requirePrincipal(request, reply);
    if (!principal) {
      return;
    }
    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = options.registry.resolve(
        principal.institution_kind,
        principal.id_institucion,
      );
      return getHistorial(adapters.pacientes, adapters.consultas, asPacienteId(parsed.data.id));
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/pacientes/:id/consultas', async (request, reply) => {
    const principal = await requirePrincipal(request, reply);
    if (!principal) {
      return;
    }
    if (!hasAnyRole(principal, ['administrador', 'medico'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const body = closeSchema.safeParse(request.body);
    if (!body.success) {
      const mapped = invalidBodyError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = options.registry.resolve(
        principal.institution_kind,
        principal.id_institucion,
      );
      const result = await closeConsulta(adapters, {
        id_paciente: asPacienteId(params.data.id),
        body: toCloseInput(body.data),
      });
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/pacientes/:id/archivo', async (request, reply) => {
    const principal = await requirePrincipal(request, reply);
    if (!principal) {
      return;
    }
    if (!hasAnyRole(principal, ['administrador', 'recepcion'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const body = archiveSchema.safeParse(request.body);
    if (!body.success) {
      const mapped = invalidBodyError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = options.registry.resolve(
        principal.institution_kind,
        principal.id_institucion,
      ) as AdapterSetWithFull;
      if (adapters.full) {
        const idem = request.headers['idempotency-key'];
        const archived = await archiveViaOp18(
          adapters,
          principal,
          params.data.id,
          body.data,
          typeof idem === 'string' ? idem : `archive-${params.data.id}-${Date.now()}`,
        );
        return reply.code(200).send(archived);
      }
      const id_paciente = asPacienteId(params.data.id);
      const expediente = await adapters.pacientes.findExpedienteByPaciente(id_paciente);
      if (!expediente) {
        return reply.code(404).send(notFoundEnvelope());
      }
      const archived = await archiveExpediente(adapters.pacientes, adapters.clock, {
        id_paciente,
        id_expediente: expediente.id_expediente,
        motivo_archivo: body.data.motivo_archivo,
        ...(body.data.observacion_archivo !== undefined
          ? { observacion_archivo: body.data.observacion_archivo }
          : {}),
      });
      return reply.code(200).send(archived);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  registerFullClinicalRoutes(app, { registry: options.registry, requirePrincipal });
  registerSpecialtyRoutes(app, { registry: options.registry, requirePrincipal });
  registerLaneABRoutes(app, { registry: options.registry, requirePrincipal });
  registerClinicalMaintenanceRoutes(app, { registry: options.registry, requirePrincipal });
  if (options.account) {
    registerAccountRoutes(app, {
      account: options.account,
      requirePrincipal,
      nowIso: options.nowIso ?? (() => new Date().toISOString()),
    });
  }
  if (options.users) {
    registerUsersRoutes(app, {
      users: options.users,
      requirePrincipal,
      nowIso: options.nowIso ?? (() => new Date().toISOString()),
    });
  }

  return app;
}

export type { InstitutionKind };
