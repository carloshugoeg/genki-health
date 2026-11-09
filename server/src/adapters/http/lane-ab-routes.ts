import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthPrincipalDto } from '@genki/shared';
import type { InstitutionAdapterRegistry } from '../../config/adapter-registry.js';
import type { AdapterSetWithFull } from '../../config/full-modules.js';
import type { OperationContext } from '../../ports/full/context.js';
import { ClinicalError } from '../../domain/clinical-error.js';
import { agendaPlugin } from './full/agenda.js';
import { chargesPlugin } from './full/charges.js';
import { honorariaPlugin } from './full/honoraria.js';
import { inventoryPlugin } from './full/inventory.js';
import { invoicingPlugin } from './full/invoicing.js';
import { paymentsPlugin } from './full/payments.js';
import { personnelPlugin } from './full/personnel.js';

function actorFrom(
  principal: AuthPrincipalDto,
  adapters: AdapterSetWithFull,
  idempotency_key?: string,
): OperationContext {
  const clinical =
    principal.roles.includes('superadministrador') ||
    principal.roles.includes('medico') ||
    principal.roles.includes('enfermeria') ||
    principal.roles.includes('odontologo') ||
    principal.roles.includes('laboratorista');
  return {
    id_institucion: principal.id_institucion,
    id_usuario: principal.id_usuario,
    id_profesional: clinical ? 1 : null,
    roles: principal.roles,
    permissions: [],
    now: adapters.clock.nowIso(),
    ...(idempotency_key ? { idempotency_key } : {}),
  };
}

function requireModule<T>(value: T | undefined, label: string): T {
  if (!value) throw new ClinicalError('misconfigured', `Módulo ${label} no cableado`);
  return value;
}

export function registerLaneABRoutes(
  app: FastifyInstance,
  options: {
    registry: InstitutionAdapterRegistry;
    requirePrincipal: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<AuthPrincipalDto | null>;
  },
): void {
  const resolveSet = (principal: AuthPrincipalDto) =>
    options.registry.resolve(
      principal.institution_kind,
      principal.id_institucion,
    ) as AdapterSetWithFull;

  void app.register(async (scope) => {
    scope.addHook('preHandler', async (request, reply) => {
      await options.requirePrincipal(request, reply);
    });

    const context = async (request: FastifyRequest): Promise<OperationContext> => {
      const principal = request.principal;
      if (!principal) throw new ClinicalError('forbidden', 'No autorizado');
      const adapters = resolveSet(principal);
      const header = request.headers['idempotency-key'];
      return actorFrom(
        principal,
        adapters,
        typeof header === 'string' ? header : undefined,
      );
    };

    const fullOf = (request: FastifyRequest) => {
      const principal = request.principal;
      if (!principal) throw new ClinicalError('forbidden', 'No autorizado');
      return requireModule(resolveSet(principal).full, 'A/B');
    };

    await scope.register(agendaPlugin, {
      resolve: async (request) => {
        const full = fullOf(request);
        return {
          repository: requireModule(full.agenda, 'agenda'),
          context: await context(request),
        };
      },
    });

    await scope.register(chargesPlugin, {
      context,
      getRepository: (request) => requireModule(fullOf(request).charges, 'cargos'),
    });
    await scope.register(personnelPlugin, {
      context,
      getRepository: (request) => requireModule(fullOf(request).personnel, 'personal'),
    });
    await scope.register(inventoryPlugin, {
      context,
      getRepository: (request) => requireModule(fullOf(request).inventory, 'inventario'),
    });
    await scope.register(honorariaPlugin, {
      context,
      getRepository: (request) => requireModule(fullOf(request).honoraria, 'honorarios'),
    });
    await scope.register(invoicingPlugin, {
      context,
      getRepository: (request) => requireModule(fullOf(request).invoicing, 'facturación'),
    });
    await scope.register(paymentsPlugin, {
      context,
      getRepository: (request) => requireModule(fullOf(request).payments, 'caja'),
    });
  });
}
