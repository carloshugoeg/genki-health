import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

const PASSWORD_KEYS = new Set(['anterior', 'nueva']);

export const ACCOUNT_SELF_ROLES = [
  'administrador',
  'recepcion',
  'medico',
  'auditor',
  'enfermeria',
  'odontologo',
  'tecnico',
  'secretaria',
  'caja',
  'almacen',
  'rrhh',
  'laboratorista',
  'superadministrador',
] as const;

export const ACCOUNT_ADMIN_ROLES = ['administrador'] as const;

/** OP-03 nueva password: ≥12 ≤200, letter + digit (stricter than locked login min-8). */
export function validateOp03Password(nueva: string): void {
  if (typeof nueva !== 'string' || nueva.length < 12 || nueva.length > 200) {
    throw new ClinicalError('password_policy', 'La contraseña no cumple la política');
  }
  if (!/[A-Za-z]/.test(nueva) || !/[0-9]/.test(nueva) || nueva.includes('\u0000')) {
    throw new ClinicalError('password_policy', 'La contraseña no cumple la política');
  }
}

export function parseOp03Body(body: unknown): { anterior: string; nueva: string } {
  if (!isPlainObject(body)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  for (const key of Object.keys(body)) {
    if (!PASSWORD_KEYS.has(key)) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
  }
  if (typeof body.anterior !== 'string' || body.anterior.length < 1 || body.anterior.length > 200) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (typeof body.nueva !== 'string') {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  validateOp03Password(body.nueva);
  return { anterior: body.anterior, nueva: body.nueva };
}

export function parseOp04Params(params: { id: number }): number {
  return assertPositiveId(params?.id, 'invalid_body');
}

export function assertAccountSelfRole(roles: readonly string[]): void {
  assertRoles(roles, ACCOUNT_SELF_ROLES);
}

export function assertAccountAdminRole(roles: readonly string[]): void {
  assertRoles(roles, ACCOUNT_ADMIN_ROLES);
}

export function generateTemporalPassword(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  if (bytes.length < 24) {
    throw new ClinicalError('internal_error', 'Error interno');
  }
  let out = '';
  for (let i = 0; i < 24; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length]!;
  }
  if (!/[A-Za-z]/.test(out) || !/[0-9]/.test(out)) {
    out = `Aa1${out.slice(3)}`;
  }
  return out;
}
