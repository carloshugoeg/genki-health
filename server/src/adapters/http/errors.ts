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
  conflict: 409,
  guardian_required: 422,
  invalid_guardians: 422,
  invalid_bundle: 422,
  reference_not_found: 422,
  store_unavailable: 503,
  misconfigured: 500,
  internal_error: 500,
};

export interface MappedHttpError {
  status: number;
  body: ErrorDto;
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
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'FST_ERR_CTP_BODY_TOO_LARGE'
  ) {
    return {
      status: 400,
      body: { error: 'invalid_body', message: 'Solicitud inválida' },
    };
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
