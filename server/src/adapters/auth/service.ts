import { createHash, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  ACCESS_TOKEN_TYP,
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TYP,
  asInstitutionId,
  asUsuarioId,
  engineForKind,
  validatePasswordPolicy,
  type AuthPrincipalDto,
  type AuthTokensDto,
  type InstitutionKind,
  type LoginRequestDto,
} from '@genki/shared';
import { AuthError, type AuthPort } from '../../ports/auth.js';
import type { IdentityStorePort, IdentityUser } from '../../ports/identity-store.js';

/** Locked CORE institution id ↔ kind pairs (hospital=1 … odontología=4). */
const INSTITUTION_ID_BY_KIND: Record<InstitutionKind, number> = {
  hospital_general: 1,
  centro_pediatrico: 2,
  laboratorio_clinico: 3,
  clinica_odontologica: 4,
};

const SUPERADMIN_ROLE = 'superadministrador';

export interface AuthClock {
  nowMs(): number;
}

export interface AuthServiceOptions {
  jwtSecret: string;
  identities: IdentityStorePort;
  clock?: AuthClock;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isInstitutionKind(value: unknown): value is InstitutionKind {
  return (
    value === 'hospital_general' ||
    value === 'centro_pediatrico' ||
    value === 'laboratorio_clinico' ||
    value === 'clinica_odontologica'
  );
}

function isSuperadmin(user: IdentityUser): boolean {
  return user.roles.includes(SUPERADMIN_ROLE);
}

/** Normal users must match home institution; superadmin may carry any valid pair. */
function claimsMatchUser(
  user: IdentityUser,
  institucion_id: number,
  institucion_kind: InstitutionKind,
): boolean {
  if (INSTITUTION_ID_BY_KIND[institucion_kind] !== institucion_id) {
    return false;
  }
  if (isSuperadmin(user)) {
    return (
      user.id_institucion === INSTITUTION_ID_BY_KIND.hospital_general &&
      user.institution_kind === 'hospital_general'
    );
  }
  return (
    user.id_institucion === institucion_id &&
    user.institution_kind === institucion_kind &&
    INSTITUTION_ID_BY_KIND[user.institution_kind] === user.id_institucion
  );
}

export function createAuthService(options: AuthServiceOptions): AuthPort {
  if (!options.jwtSecret || options.jwtSecret.length < 16) {
    throw new AuthError('JWT_SECRET must be at least 16 characters', 'misconfigured');
  }
  const secret = new TextEncoder().encode(options.jwtSecret);
  const identities = options.identities;
  const nowMs = () => (options.clock ? options.clock.nowMs() : Date.now());

  const nowIso = () => new Date(nowMs()).toISOString();
  const nowSec = () => Math.floor(nowMs() / 1000);

  async function issueTokens(
    user: IdentityUser,
    active: { institucion_id: number; institucion_kind: InstitutionKind },
  ): Promise<AuthTokensDto> {
    const issuedAt = nowSec();
    const motor = engineForKind(active.institucion_kind);
    const jti = randomUUID();
    const created = nowIso();
    const expires_at = new Date(nowMs() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();

    await identities.insertRefresh({
      jti_hash: sha256Hex(jti),
      id_usuario: user.id_usuario,
      created_at: created,
      expires_at,
    });

    const access_token = await new SignJWT({
      email: user.email,
      institucion_id: active.institucion_id,
      institucion_kind: active.institucion_kind,
      roles: user.roles,
      motor,
      typ: ACCESS_TOKEN_TYP,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(user.id_usuario))
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
      .sign(secret);

    const refresh_token = await new SignJWT({
      institucion_id: active.institucion_id,
      institucion_kind: active.institucion_kind,
      jti,
      typ: REFRESH_TOKEN_TYP,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(user.id_usuario))
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + REFRESH_TOKEN_TTL_SECONDS)
      .sign(secret);

    return {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  async function rotateAndIssue(
    user: IdentityUser,
    oldJti: string,
    active: { institucion_id: number; institucion_kind: InstitutionKind },
  ): Promise<AuthTokensDto> {
    const nextJti = randomUUID();
    const created = nowIso();
    const expires_at = new Date(nowMs() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();
    const won = await identities.rotateRefresh(
      sha256Hex(oldJti),
      {
        jti_hash: sha256Hex(nextJti),
        id_usuario: user.id_usuario,
        created_at: created,
        expires_at,
      },
      created,
    );
    if (!won) {
      throw new AuthError('Refresh token revoked or unknown', 'invalid_token');
    }

    const issuedAt = nowSec();
    const motor = engineForKind(active.institucion_kind);
    const access_token = await new SignJWT({
      email: user.email,
      institucion_id: active.institucion_id,
      institucion_kind: active.institucion_kind,
      roles: user.roles,
      motor,
      typ: ACCESS_TOKEN_TYP,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(user.id_usuario))
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
      .sign(secret);

    const refresh_token = await new SignJWT({
      institucion_id: active.institucion_id,
      institucion_kind: active.institucion_kind,
      jti: nextJti,
      typ: REFRESH_TOKEN_TYP,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(user.id_usuario))
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + REFRESH_TOKEN_TTL_SECONDS)
      .sign(secret);

    return {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  async function verifyRefreshJwt(refreshToken: string): Promise<{
    jti: string;
    sub: number;
    institucion_id: number;
    institucion_kind: InstitutionKind;
  }> {
    let payload: Record<string, unknown>;
    try {
      const verified = await jwtVerify(refreshToken, secret, {
        algorithms: ['HS256'],
        currentDate: new Date(nowMs()),
      });
      payload = verified.payload as Record<string, unknown>;
    } catch {
      throw new AuthError('Invalid refresh token', 'invalid_token');
    }

    if (payload.typ !== REFRESH_TOKEN_TYP || typeof payload.jti !== 'string') {
      throw new AuthError('Invalid refresh token', 'invalid_token');
    }
    if (typeof payload.sub !== 'string' && typeof payload.sub !== 'number') {
      throw new AuthError('Invalid refresh token', 'invalid_token');
    }
    const sub = typeof payload.sub === 'number' ? payload.sub : Number(payload.sub);
    const institucion_id =
      typeof payload.institucion_id === 'number'
        ? payload.institucion_id
        : Number(payload.institucion_id);
    if (
      !Number.isInteger(sub) ||
      !Number.isInteger(institucion_id) ||
      !isInstitutionKind(payload.institucion_kind)
    ) {
      throw new AuthError('Invalid refresh token', 'invalid_token');
    }
    if (INSTITUTION_ID_BY_KIND[payload.institucion_kind] !== institucion_id) {
      throw new AuthError('Invalid refresh token', 'invalid_token');
    }

    return {
      jti: payload.jti,
      sub,
      institucion_id,
      institucion_kind: payload.institucion_kind,
    };
  }

  async function verifyAccess(accessToken: string): Promise<AuthPrincipalDto> {
    let payload: Record<string, unknown>;
    try {
      const verified = await jwtVerify(accessToken, secret, {
        algorithms: ['HS256'],
        currentDate: new Date(nowMs()),
      });
      payload = verified.payload as Record<string, unknown>;
    } catch {
      throw new AuthError('Invalid access token', 'invalid_token');
    }

    if (payload.typ !== ACCESS_TOKEN_TYP) {
      throw new AuthError('Invalid access token', 'invalid_token');
    }
    if (typeof payload.sub !== 'string' && typeof payload.sub !== 'number') {
      throw new AuthError('Invalid access token', 'invalid_token');
    }
    if (typeof payload.email !== 'string' || !payload.email) {
      throw new AuthError('Invalid access token', 'invalid_token');
    }
    if (!isInstitutionKind(payload.institucion_kind)) {
      throw new AuthError('Invalid access token', 'invalid_token');
    }
    if (typeof payload.institucion_id !== 'number' || !Number.isInteger(payload.institucion_id)) {
      throw new AuthError('Invalid access token', 'invalid_token');
    }
    if (!Array.isArray(payload.roles) || !payload.roles.every((r) => typeof r === 'string')) {
      throw new AuthError('Invalid access token', 'invalid_token');
    }

    const sub = typeof payload.sub === 'number' ? payload.sub : Number(payload.sub);
    if (!Number.isInteger(sub)) {
      throw new AuthError('Invalid access token', 'invalid_token');
    }

    const institucion_kind = payload.institucion_kind;
    const institucion_id = payload.institucion_id;
    if (INSTITUTION_ID_BY_KIND[institucion_kind] !== institucion_id) {
      throw new AuthError('Invalid access token', 'invalid_token');
    }
    if (payload.motor !== engineForKind(institucion_kind)) {
      throw new AuthError('Token motor does not match institution', 'invalid_token');
    }

    const user = await identities.findUserById(sub);
    if (!user || user.estado !== 'activo') {
      throw new AuthError('Invalid access token', 'invalid_token');
    }
    if (!claimsMatchUser(user, institucion_id, institucion_kind)) {
      throw new AuthError('Invalid access token', 'invalid_token');
    }

    return {
      id_usuario: asUsuarioId(sub),
      email: payload.email,
      id_institucion: asInstitutionId(institucion_id),
      institution_kind: institucion_kind,
      roles: payload.roles.map(String),
      motor: engineForKind(institucion_kind),
    };
  }

  return {
    async login(input: LoginRequestDto): Promise<AuthTokensDto> {
      const policyError = validatePasswordPolicy(input.password);
      if (policyError) {
        throw new AuthError(policyError, 'password_policy');
      }

      const email = input.email.trim().toLowerCase();
      const user = await identities.findUser(email, input.institution_kind);
      if (!user || user.estado !== 'activo') {
        throw new AuthError('Invalid email, password, or institution', 'invalid_credentials');
      }
      if (!claimsMatchUser(user, user.id_institucion, user.institution_kind)) {
        throw new AuthError('Invalid email, password, or institution', 'invalid_credentials');
      }

      const ok = await argon2.verify(user.hash_contrasena, input.password);
      if (!ok) {
        throw new AuthError('Invalid email, password, or institution', 'invalid_credentials');
      }

      return issueTokens(user, {
        institucion_id: user.id_institucion,
        institucion_kind: user.institution_kind,
      });
    },

    async refresh(refreshToken: string): Promise<AuthTokensDto> {
      const claims = await verifyRefreshJwt(refreshToken);
      const user = await identities.findUserById(claims.sub);
      if (!user || user.estado !== 'activo') {
        throw new AuthError('Invalid refresh token', 'invalid_token');
      }
      if (!claimsMatchUser(user, claims.institucion_id, claims.institucion_kind)) {
        throw new AuthError('Invalid refresh token', 'invalid_token');
      }

      return rotateAndIssue(user, claims.jti, {
        institucion_id: claims.institucion_id,
        institucion_kind: claims.institucion_kind,
      });
    },

    async verifyAccessToken(accessToken: string): Promise<AuthPrincipalDto> {
      return verifyAccess(accessToken);
    },

    async logout(refreshToken: string): Promise<void> {
      const claims = await verifyRefreshJwt(refreshToken);
      await identities.revokeRefresh(sha256Hex(claims.jti), nowIso());
    },

    async selectInstitution(
      accessToken: string,
      refreshToken: string,
      institution_kind: InstitutionKind,
    ): Promise<AuthTokensDto> {
      const principal = await verifyAccess(accessToken);
      if (!principal.roles.includes(SUPERADMIN_ROLE)) {
        throw new AuthError('Solo el superadministrador puede cambiar de institución', 'forbidden');
      }
      const claims = await verifyRefreshJwt(refreshToken);
      if (claims.sub !== principal.id_usuario) {
        throw new AuthError('Invalid refresh token', 'invalid_token');
      }
      const user = await identities.findUserById(principal.id_usuario);
      if (!user || user.estado !== 'activo' || !isSuperadmin(user)) {
        throw new AuthError('Solo el superadministrador puede cambiar de institución', 'forbidden');
      }
      const institucion_id = INSTITUTION_ID_BY_KIND[institution_kind];
      if (!claimsMatchUser(user, institucion_id, institution_kind)) {
        throw new AuthError('Invalid institution selection', 'invalid_token');
      }
      return rotateAndIssue(user, claims.jti, {
        institucion_id,
        institucion_kind: institution_kind,
      });
    },
  };
}
