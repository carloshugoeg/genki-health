/**
 * Auth contracts (fixed 2026-10-19): email + password, Argon2id, access JWT + refresh JWT.
 */

import type { DataEngine, InstitutionKind } from './engines.js';
import type { InstitutionId, UsuarioId } from './ids.js';

/** Access JWT TTL — 30 minutes. */
export const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;

/** Refresh JWT TTL — 14 days. */
export const REFRESH_TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60;

export const ACCESS_TOKEN_TYP = 'access' as const;
export const REFRESH_TOKEN_TYP = 'refresh' as const;

/** Exact access claim set (locked). */
export interface AccessTokenClaims {
  sub: string;
  email: string;
  institucion_id: number;
  institucion_kind: InstitutionKind;
  roles: string[];
  motor: DataEngine;
  iat: number;
  exp: number;
  typ: typeof ACCESS_TOKEN_TYP;
}

/** Exact refresh claim set (locked). */
export interface RefreshTokenClaims {
  sub: string;
  institucion_id: number;
  institucion_kind: InstitutionKind;
  jti: string;
  iat: number;
  exp: number;
  typ: typeof REFRESH_TOKEN_TYP;
}

export interface LoginRequestDto {
  email: string;
  password: string;
  institution_kind: InstitutionKind;
}

export interface AuthTokensDto {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface AuthPrincipalDto {
  id_usuario: UsuarioId;
  email: string;
  id_institucion: InstitutionId;
  institution_kind: InstitutionKind;
  roles: string[];
  motor: DataEngine;
}

/**
 * Password policy (“el estándar”, Carlos 2026-10-19):
 * min 8 characters; at least one letter and one digit.
 */
export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one digit';
  }
  return null;
}
