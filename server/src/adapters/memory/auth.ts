import { randomUUID } from 'node:crypto';
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

interface StoredUser {
  id_usuario: number;
  email: string;
  hash_contrasena: string;
  id_institucion: number;
  institution_kind: InstitutionKind;
  roles: string[];
  estado: 'activo' | 'bloqueado' | 'inactivo';
}

export interface MemoryAuthOptions {
  jwtSecret: string;
  /** Optional pre-hashed demo users; if omitted, demo users are built on construct. */
  users?: StoredUser[];
}

const DEMO_PASSWORD = 'GenkiDev1';

/** Demo accounts for memory SoR (tests + local). Password: GenkiDev1 */
export const DEMO_AUTH_USERS: ReadonlyArray<{
  email: string;
  institution_kind: InstitutionKind;
  id_institucion: number;
  roles: string[];
}> = [
  {
    email: 'hospital@genki.local',
    institution_kind: 'hospital_general',
    id_institucion: 1,
    roles: ['administrador'],
  },
  {
    email: 'pediatrico@genki.local',
    institution_kind: 'centro_pediatrico',
    id_institucion: 2,
    roles: ['medico'],
  },
  {
    email: 'laboratorio@genki.local',
    institution_kind: 'laboratorio_clinico',
    id_institucion: 3,
    roles: ['tecnico'],
  },
  {
    email: 'dental@genki.local',
    institution_kind: 'clinica_odontologica',
    id_institucion: 4,
    roles: ['secretaria'],
  },
];

export async function buildDemoUsers(): Promise<StoredUser[]> {
  const policy = validatePasswordPolicy(DEMO_PASSWORD);
  if (policy) {
    throw new Error(`Demo password violates policy: ${policy}`);
  }
  const hash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
  return DEMO_AUTH_USERS.map((row, index) => ({
    id_usuario: index + 1,
    email: row.email,
    hash_contrasena: hash,
    id_institucion: row.id_institucion,
    institution_kind: row.institution_kind,
    roles: [...row.roles],
    estado: 'activo' as const,
  }));
}

export class MemoryAuthAdapter implements AuthPort {
  private readonly secret: Uint8Array;
  private readonly users: StoredUser[];
  private readonly refreshJtis = new Set<string>();

  private constructor(jwtSecret: string, users: StoredUser[]) {
    if (!jwtSecret || jwtSecret.length < 16) {
      throw new AuthError('JWT_SECRET must be at least 16 characters', 'misconfigured');
    }
    this.secret = new TextEncoder().encode(jwtSecret);
    this.users = users;
  }

  static async create(options: MemoryAuthOptions): Promise<MemoryAuthAdapter> {
    const users = options.users ?? (await buildDemoUsers());
    return new MemoryAuthAdapter(options.jwtSecret, users);
  }

  async login(input: LoginRequestDto): Promise<AuthTokensDto> {
    const policyError = validatePasswordPolicy(input.password);
    if (policyError) {
      throw new AuthError(policyError, 'password_policy');
    }

    const email = input.email.trim().toLowerCase();
    const user = this.users.find(
      (row) => row.email.toLowerCase() === email && row.institution_kind === input.institution_kind,
    );

    if (!user || user.estado !== 'activo') {
      throw new AuthError('Invalid email, password, or institution', 'invalid_credentials');
    }

    const ok = await argon2.verify(user.hash_contrasena, input.password);
    if (!ok) {
      throw new AuthError('Invalid email, password, or institution', 'invalid_credentials');
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    let payload: Record<string, unknown>;
    try {
      const verified = await jwtVerify(refreshToken, this.secret);
      payload = verified.payload as Record<string, unknown>;
    } catch {
      throw new AuthError('Invalid refresh token', 'invalid_token');
    }

    if (payload.typ !== REFRESH_TOKEN_TYP || typeof payload.jti !== 'string') {
      throw new AuthError('Invalid refresh token', 'invalid_token');
    }
    if (!this.refreshJtis.has(payload.jti)) {
      throw new AuthError('Refresh token revoked or unknown', 'invalid_token');
    }

    this.refreshJtis.delete(payload.jti);

    const sub = Number(payload.sub);
    const user = this.users.find((row) => row.id_usuario === sub);
    if (!user || user.estado !== 'activo') {
      throw new AuthError('Invalid refresh token', 'invalid_token');
    }
    if (
      user.id_institucion !== payload.institucion_id ||
      user.institution_kind !== payload.institucion_kind
    ) {
      throw new AuthError('Invalid refresh token', 'invalid_token');
    }

    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    let payload: Record<string, unknown>;
    try {
      const verified = await jwtVerify(refreshToken, this.secret);
      payload = verified.payload as Record<string, unknown>;
    } catch {
      throw new AuthError('Invalid refresh token', 'invalid_token');
    }
    if (payload.typ !== REFRESH_TOKEN_TYP || typeof payload.jti !== 'string') {
      throw new AuthError('Invalid refresh token', 'invalid_token');
    }
    this.refreshJtis.delete(payload.jti);
  }

  async verifyAccessToken(accessToken: string): Promise<AuthPrincipalDto> {
    let payload: Record<string, unknown>;
    try {
      const verified = await jwtVerify(accessToken, this.secret);
      payload = verified.payload as Record<string, unknown>;
    } catch {
      throw new AuthError('Invalid access token', 'invalid_token');
    }

    if (payload.typ !== ACCESS_TOKEN_TYP) {
      throw new AuthError('Invalid access token', 'invalid_token');
    }

    const sub = Number(payload.sub);
    const institucion_id = Number(payload.institucion_id);
    const institucion_kind = payload.institucion_kind as InstitutionKind;
    const email = String(payload.email ?? '');
    const roles = Array.isArray(payload.roles) ? payload.roles.map(String) : [];
    const motor = payload.motor;

    if (!Number.isFinite(sub) || !Number.isFinite(institucion_id) || !email) {
      throw new AuthError('Invalid access token', 'invalid_token');
    }
    if (motor !== engineForKind(institucion_kind)) {
      throw new AuthError('Token motor does not match institution', 'invalid_token');
    }

    return {
      id_usuario: asUsuarioId(sub),
      email,
      id_institucion: asInstitutionId(institucion_id),
      institution_kind: institucion_kind,
      roles,
      motor: engineForKind(institucion_kind),
    };
  }

  private async issueTokens(user: StoredUser): Promise<AuthTokensDto> {
    const now = Math.floor(Date.now() / 1000);
    const motor = engineForKind(user.institution_kind);
    const jti = randomUUID();
    this.refreshJtis.add(jti);

    const access_token = await new SignJWT({
      email: user.email,
      institucion_id: user.id_institucion,
      institucion_kind: user.institution_kind,
      roles: user.roles,
      motor,
      typ: ACCESS_TOKEN_TYP,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(user.id_usuario))
      .setIssuedAt(now)
      .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
      .sign(this.secret);

    const refresh_token = await new SignJWT({
      institucion_id: user.id_institucion,
      institucion_kind: user.institution_kind,
      jti,
      typ: REFRESH_TOKEN_TYP,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(user.id_usuario))
      .setIssuedAt(now)
      .setExpirationTime(now + REFRESH_TOKEN_TTL_SECONDS)
      .sign(this.secret);

    return {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    };
  }
}
