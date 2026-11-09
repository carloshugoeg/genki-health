import { ClinicalError } from '../clinical-error.js';

export function assertPositiveId(value: unknown, code: 'invalid_query' | 'invalid_body' = 'invalid_query'): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new ClinicalError(code, 'Solicitud inválida');
  }
  return value;
}

export function assertRoles(roles: readonly string[], allowed: readonly string[]): void {
  if (roles.includes('superadministrador')) return;
  if (!roles.some((r) => allowed.includes(r))) {
    throw new ClinicalError('forbidden', 'No autorizado');
  }
}

export function requireIdempotencyKey(key: string | undefined): string {
  if (!key || key.length < 1 || key.length > 80) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return key;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
