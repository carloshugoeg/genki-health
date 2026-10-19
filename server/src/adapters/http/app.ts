import Fastify from 'fastify';
import { AuthNotConfiguredError } from '../../ports/index.js';
import type { InstitutionAdapterRegistry } from '../../config/adapter-registry.js';
import { registerPaciente } from '../../application/register-paciente.js';
import { asInstitutionId, type InstitutionKind } from '@genki/shared';

export interface HttpAppOptions {
  registry: InstitutionAdapterRegistry;
  /** Temporary until Auth decides how institution is resolved from the session. */
  defaultKind: InstitutionKind;
  defaultInstitutionId?: number;
}

export function buildHttpApp(options: HttpAppOptions) {
  const app = Fastify({ logger: false });
  const institutionId = asInstitutionId(options.defaultInstitutionId ?? 1);

  app.get('/health', async () => ({ ok: true, phase: 'e2-01-scaffold' }));

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
    const adapters = options.registry.resolve(options.defaultKind, institutionId);
    const result = await registerPaciente(adapters.pacientes, request.body);
    return reply.code(201).send(result);
  });

  app.post('/api/auth/login', async (_request, reply) => {
    const adapters = options.registry.resolve(options.defaultKind, institutionId);
    try {
      await adapters.auth.login({ nombre_usuario: '', contrasena: '' });
      return reply.code(501).send({ error: 'unreachable' });
    } catch (error) {
      if (error instanceof AuthNotConfiguredError) {
        return reply.code(501).send({
          error: 'auth_needs_human',
          message:
            'Login is blocked until Carlos decides Auth (JWT claims, password policy, session).',
        });
      }
      throw error;
    }
  });

  return app;
}
