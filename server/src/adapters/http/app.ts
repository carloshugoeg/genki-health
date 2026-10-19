import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { type AuthPrincipalDto, type InstitutionKind, type LoginRequestDto } from '@genki/shared';
import { registerPaciente } from '../../application/register-paciente.js';
import type { InstitutionAdapterRegistry } from '../../config/adapter-registry.js';
import { AuthError, isInstitutionKind, type AuthPort } from '../../ports/index.js';

export interface HttpAppOptions {
  registry: InstitutionAdapterRegistry;
  auth: AuthPort;
}

declare module 'fastify' {
  interface FastifyRequest {
    principal?: AuthPrincipalDto;
  }
}

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

function authErrorStatus(error: AuthError): number {
  switch (error.code) {
    case 'password_policy':
      return 400;
    case 'invalid_credentials':
      return 401;
    case 'invalid_token':
      return 401;
    case 'misconfigured':
      return 500;
    default:
      return 401;
  }
}

export function buildHttpApp(options: HttpAppOptions) {
  const app = Fastify({ logger: false });

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
        await reply
          .code(authErrorStatus(error))
          .send({ error: error.code, message: error.message });
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
      return reply.code(400).send({
        error: 'invalid_body',
        message: 'email, password, and institution_kind are required',
      });
    }

    try {
      const tokens = await options.auth.login({
        email: body.email,
        password: body.password,
        institution_kind: body.institution_kind,
      });
      return reply.code(200).send(tokens);
    } catch (error) {
      if (error instanceof AuthError) {
        return reply
          .code(authErrorStatus(error))
          .send({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  app.post<{ Body: { refresh_token?: string } }>('/api/auth/refresh', async (request, reply) => {
    const refresh_token = request.body?.refresh_token;
    if (!refresh_token || typeof refresh_token !== 'string') {
      return reply.code(400).send({ error: 'invalid_body', message: 'refresh_token is required' });
    }
    try {
      const tokens = await options.auth.refresh(refresh_token);
      return reply.code(200).send(tokens);
    } catch (error) {
      if (error instanceof AuthError) {
        return reply
          .code(authErrorStatus(error))
          .send({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  app.get('/api/auth/me', async (request, reply) => {
    const principal = await requirePrincipal(request, reply);
    if (!principal) {
      return;
    }
    return principal;
  });

  app.post<{
    Body: {
      tipo_documento: string;
      numero_documento: string;
      primer_nombre: string;
      primer_apellido: string;
      fecha_nacimiento: string;
      sexo: 'M' | 'F' | 'X';
    };
  }>('/api/pacientes', async (request, reply) => {
    const principal = await requirePrincipal(request, reply);
    if (!principal) {
      return;
    }
    const adapters = options.registry.resolve(principal.institution_kind, principal.id_institucion);
    const result = await registerPaciente(adapters.pacientes, request.body);
    return reply.code(201).send(result);
  });

  return app;
}

export type { InstitutionKind };
