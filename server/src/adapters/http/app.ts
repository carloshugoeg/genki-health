import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  asPacienteId,
  type AuthPrincipalDto,
  type InstitutionKind,
  type LoginRequestDto,
  type RegisterPacienteRequest,
} from '@genki/shared';
import { archiveExpediente } from '../../application/archive-expediente.js';
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
import { archiveSchema, paramsSchema, registerSchema, searchSchema } from './schemas.js';

export interface HttpAppOptions {
  registry: InstitutionAdapterRegistry;
  auth: AuthPort;
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

  app.get('/api/auth/me', async (request, reply) => {
    const principal = await requirePrincipal(request, reply);
    if (!principal) {
      return;
    }
    return principal;
  });

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
      );
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

  return app;
}

export type { InstitutionKind };
