import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthPrincipalDto } from '@genki/shared';
import { executeOp17 } from '../../application/full/attachments.js';
import { executeOp26, executeOp27 } from '../../application/full/consultation.js';
import {
  executeOp12,
  executeOp15,
  executeOp16,
  executeOp18,
  executeOp19,
} from '../../application/full/record.js';
import type { AdapterSet, InstitutionAdapterRegistry } from '../../config/adapter-registry.js';
import { fullModulesFromSet, type AdapterSetWithFull } from '../../config/full-modules.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import { ClinicalError } from '../../domain/clinical-error.js';
import { ATTACHMENT_MAX_BYTES } from '../../domain/full/attachments.js';
import { forbiddenError, invalidBodyError, invalidQueryError, toErrorDto } from './errors.js';
import { archiveSchema, paramsSchema } from './schemas.js';
import { profesionalOf } from './actor.js';

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
    // USUARIO.id_profesional of the authenticated user (null for non-clinical users).
    id_profesional: profesionalOf(principal),
    roles: principal.roles,
    permissions: [],
    now: adapters.clock.nowIso(),
    ...(idempotency_key ? { idempotency_key } : {}),
  };
}

function fullContext(adapters: AdapterSetWithFull): FullContext {
  if (!adapters.full) {
    throw new ClinicalError('misconfigured', 'Módulos clínicos lane-1 no cableados');
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

const DOCUMENT_JSON_KEYS = new Set([
  'archivo_base64',
  'tipo_mime',
  'nombre_archivo',
  'id_consulta',
]);
const DOCUMENT_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const DATA_URL = /^data:([\w.+-]+\/[\w.+-]+);base64,/i;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Base64 inflates the file by 4/3. Leave headroom for the JSON envelope so a file at the
 * domain cap (ATTACHMENT_MAX_BYTES) still reaches the domain check instead of a 413.
 */
export const DOCUMENT_BODY_LIMIT_BYTES = Math.ceil((ATTACHMENT_MAX_BYTES * 4) / 3) + 64 * 1024;

/**
 * OP-17 JSON contract: `{ archivo_base64, tipo_mime?, nombre_archivo?, id_consulta? }`.
 * `archivo_base64` may be raw base64 or a `data:<mime>;base64,` URL (FileReader output).
 * The domain needs a named `File`, so the name defaults to `documento.<ext>`.
 */
function parseDocumentJson(body: unknown): { archivo: File; id_consulta?: number } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  for (const key of Object.keys(body)) {
    if (!DOCUMENT_JSON_KEYS.has(key)) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
  }
  const row = body as {
    archivo_base64?: unknown;
    id_consulta?: unknown;
    tipo_mime?: unknown;
    nombre_archivo?: unknown;
  };
  if (typeof row.archivo_base64 !== 'string' || row.archivo_base64.length === 0) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  let encoded = row.archivo_base64;
  let mime = typeof row.tipo_mime === 'string' ? row.tipo_mime.trim().toLowerCase() : undefined;
  if (row.tipo_mime !== undefined && typeof row.tipo_mime !== 'string') {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const dataUrl = DATA_URL.exec(encoded);
  if (dataUrl) {
    encoded = encoded.slice(dataUrl[0].length);
    mime ??= dataUrl[1]!.toLowerCase();
  }
  encoded = encoded.replace(/\s+/g, '');
  if (encoded.length === 0 || encoded.length % 4 === 1 || !BASE64.test(encoded)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const type = mime ?? 'application/octet-stream';
  let nombre: string;
  if (row.nombre_archivo === undefined || row.nombre_archivo === null) {
    nombre = `documento.${DOCUMENT_EXTENSIONS[type] ?? 'bin'}`;
  } else if (typeof row.nombre_archivo === 'string') {
    nombre = row.nombre_archivo;
  } else {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const buffer = Buffer.from(encoded, 'base64');
  const out: { archivo: File; id_consulta?: number } = {
    archivo: new File([buffer], nombre, { type }),
  };
  if (row.id_consulta !== undefined) {
    if (typeof row.id_consulta !== 'number' || !Number.isInteger(row.id_consulta)) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
    out.id_consulta = row.id_consulta;
  }
  return out;
}

export function registerFullClinicalRoutes(
  app: FastifyInstance,
  options: {
    registry: InstitutionAdapterRegistry;
    requirePrincipal: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<AuthPrincipalDto | null>;
  },
): void {
  app.get('/api/pacientes/:id/ficha', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!hasAnyRole(principal, ['medico', 'odontologo', 'enfermeria', 'administrador'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = options.registry.resolve(
        principal.institution_kind,
        principal.id_institucion,
      ) as AdapterSetWithFull;
      return await executeOp12(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: {} },
        actorFrom(principal, adapters),
      );
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/pacientes/:id/antecedentes', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!hasAnyRole(principal, ['medico', 'odontologo', 'enfermeria'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = options.registry.resolve(
        principal.institution_kind,
        principal.id_institucion,
      ) as AdapterSetWithFull;
      const result = await executeOp15(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/pacientes/:id/alergias', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!hasAnyRole(principal, ['medico', 'odontologo', 'enfermeria'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = options.registry.resolve(
        principal.institution_kind,
        principal.id_institucion,
      ) as AdapterSetWithFull;
      const result = await executeOp16(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  // OP-17 accepts JSON only (no multipart parser is registered: multipart answers 415).
  app.post(
    '/api/pacientes/:id/documentos',
    { bodyLimit: DOCUMENT_BODY_LIMIT_BYTES },
    async (request, reply) => {
      const principal = await options.requirePrincipal(request, reply);
      if (!principal) return;
      if (!hasAnyRole(principal, ['medico', 'odontologo', 'enfermeria', 'administrador'])) {
        const mapped = forbiddenError();
        return reply.code(mapped.status).send(mapped.body);
      }
      const params = paramsSchema.safeParse(request.params);
      if (!params.success) {
        const mapped = invalidQueryError();
        return reply.code(mapped.status).send(mapped.body);
      }
      try {
        const parsed = parseDocumentJson(request.body);
        const adapters = options.registry.resolve(
          principal.institution_kind,
          principal.id_institucion,
        ) as AdapterSetWithFull;
        const result = await executeOp17(
          fullContext(adapters),
          { params: { id: params.data.id }, query: {}, body: parsed },
          actorFrom(principal, adapters, idempotencyKey(request)),
        );
        return reply.code(201).send(result);
      } catch (error) {
        return sendMapped(reply, error);
      }
    },
  );

  app.post('/api/pacientes/:id/reactivacion', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!hasAnyRole(principal, ['administrador'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = options.registry.resolve(
        principal.institution_kind,
        principal.id_institucion,
      ) as AdapterSetWithFull;
      const idem = idempotencyKey(request) ?? `reactivacion-${params.data.id}-${Date.now()}`;
      return await executeOp19(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idem),
      );
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.post('/api/pacientes/:id/consultas/abiertas', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!hasAnyRole(principal, ['medico', 'odontologo'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = options.registry.resolve(
        principal.institution_kind,
        principal.id_institucion,
      ) as AdapterSetWithFull;
      const result = await executeOp26(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });

  app.put('/api/consultas/:id/signos', async (request, reply) => {
    const principal = await options.requirePrincipal(request, reply);
    if (!principal) return;
    if (!hasAnyRole(principal, ['medico', 'enfermeria', 'odontologo'])) {
      const mapped = forbiddenError();
      return reply.code(mapped.status).send(mapped.body);
    }
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      const mapped = invalidQueryError();
      return reply.code(mapped.status).send(mapped.body);
    }
    try {
      const adapters = options.registry.resolve(
        principal.institution_kind,
        principal.id_institucion,
      ) as AdapterSetWithFull;
      const result = await executeOp27(
        fullContext(adapters),
        { params: { id: params.data.id }, query: {}, body: request.body as never },
        actorFrom(principal, adapters, idempotencyKey(request)),
      );
      return reply.code(200).send(result);
    } catch (error) {
      return sendMapped(reply, error);
    }
  });
}

/** OP-18 archive used by the MVP archive route when lane-1 modules are wired. */
export async function archiveViaOp18(
  adapters: AdapterSetWithFull,
  principal: AuthPrincipalDto,
  id: number,
  body: unknown,
  idempotency_key?: string,
) {
  const parsed = archiveSchema.safeParse(body);
  if (!parsed.success) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const archiveBody =
    parsed.data.observacion_archivo !== undefined
      ? {
          motivo_archivo: parsed.data.motivo_archivo,
          observacion_archivo: parsed.data.observacion_archivo,
        }
      : { motivo_archivo: parsed.data.motivo_archivo };
  return executeOp18(
    fullContext(adapters),
    { params: { id }, query: {}, body: archiveBody },
    actorFrom(principal, adapters, idempotency_key),
  );
}

export { invalidBodyError };
