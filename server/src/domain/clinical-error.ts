export const CLINICAL_ERROR_CODES = [
  'invalid_body',
  'invalid_query',
  'missing_bearer',
  'invalid_credentials',
  'invalid_token',
  'password_policy',
  'forbidden',
  'not_found',
  'duplicate_document',
  'guardian_required',
  'invalid_guardians',
  'expediente_archived',
  'already_archived',
  'invalid_bundle',
  'reference_not_found',
  'conflict',
  'store_unavailable',
  'misconfigured',
  'internal_error',
] as const;

export type ClinicalErrorCode = (typeof CLINICAL_ERROR_CODES)[number];

export class ClinicalError extends Error {
  static readonly CODES = CLINICAL_ERROR_CODES;

  constructor(
    readonly code: ClinicalErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ClinicalError';
  }
}
