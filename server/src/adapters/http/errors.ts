import type { ClinicalErrorCode, ErrorDto } from '@genki/shared';
import { ClinicalError } from '../../domain/clinical-error.js';
import { AuthError } from '../../ports/auth.js';

const CLINICAL_STATUS: Record<ClinicalErrorCode, number> = {
  invalid_body: 400,
  invalid_query: 400,
  password_policy: 400,
  missing_bearer: 401,
  invalid_credentials: 401,
  invalid_token: 401,
  forbidden: 403,
  not_found: 404,
  duplicate_document: 409,
  expediente_archived: 409,
  already_archived: 409,
  consulta_abierta: 409,
  conflict: 409,
  guardian_required: 422,
  invalid_guardians: 422,
  invalid_bundle: 422,
  reference_not_found: 422,
  store_unavailable: 503,
  misconfigured: 500,
  internal_error: 500,
};

/**
 * Transport-only codes produced before a route runs (body parser / media type / size).
 * They are not domain codes, so they stay out of the shared `ClinicalErrorCode` union.
 */
export type TransportErrorCode = 'unsupported_media_type' | 'payload_too_large';

export interface HttpErrorBody {
  error: ClinicalErrorCode | TransportErrorCode;
  message: string;
}

export interface MappedHttpError {
  status: number;
  body: ErrorDto | HttpErrorBody;
}

/**
 * Fastify raises 4xx errors before the handler runs: malformed JSON (`SyntaxError` with
 * statusCode 400), `FST_ERR_CTP_EMPTY_JSON_BODY`, `FST_ERR_CTP_INVALID_MEDIA_TYPE` (415),
 * `FST_ERR_CTP_BODY_TOO_LARGE` (413), `FST_ERR_CTP_INVALID_CONTENT_LENGTH`, etc. They are the
 * client's fault, so they must never surface as `internal_error`.
 */
function fastifyClientError(error: unknown): MappedHttpError | null {
  if (typeof error !== 'object' || error === null) return null;
  const { statusCode, code } = error as { statusCode?: unknown; code?: unknown };
  if (typeof statusCode !== 'number' || statusCode < 400 || statusCode > 499) return null;
  const isFastify = typeof code === 'string' && code.startsWith('FST_');
  if (!isFastify && !(error instanceof SyntaxError)) return null;
  if (statusCode === 413 || code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return {
      status: 413,
      body: { error: 'payload_too_large', message: 'La solicitud excede el tamaño permitido' },
    };
  }
  if (statusCode === 415 || code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    return {
      status: 415,
      body: { error: 'unsupported_media_type', message: 'Tipo de contenido no soportado' },
    };
  }
  return invalidBodyError();
}

export function toErrorDto(error: unknown): MappedHttpError {
  if (error instanceof ClinicalError) {
    return {
      status: CLINICAL_STATUS[error.code],
      body: { error: error.code, message: error.message },
    };
  }
  if (error instanceof AuthError) {
    const status =
      error.code === 'password_policy'
        ? 400
        : error.code === 'forbidden'
          ? 403
          : error.code === 'misconfigured'
            ? 500
            : 401;
    return {
      status,
      body: {
        error: error.code,
        message: error.message,
      },
    };
  }
  const client = fastifyClientError(error);
  if (client) {
    return client;
  }
  return {
    status: 500,
    body: { error: 'internal_error', message: 'Error interno' },
  };
}

export function invalidQueryError(): MappedHttpError {
  return {
    status: 400,
    body: { error: 'invalid_query', message: 'Parámetros inválidos' },
  };
}

export function invalidBodyError(): MappedHttpError {
  return {
    status: 400,
    body: { error: 'invalid_body', message: 'Solicitud inválida' },
  };
}

export function forbiddenError(): MappedHttpError {
  return {
    status: 403,
    body: { error: 'forbidden', message: 'Permiso insuficiente' },
  };
}

export function notFoundEnvelope(): ErrorDto {
  return { error: 'not_found', message: 'Recurso no encontrado' };
}
