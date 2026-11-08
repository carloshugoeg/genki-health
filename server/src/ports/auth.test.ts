import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  ACCESS_TOKEN_TYP,
  REFRESH_TOKEN_TTL_SECONDS,
  engineForKind,
} from '@genki/shared';
import { createAuthService } from '../adapters/auth/service.js';
import { MemoryIdentityStore, buildDemoUsers } from '../adapters/memory/auth.js';
import { buildHttpApp } from '../adapters/http/app.js';
import { createPhase0Auth, createPhase0Registry } from '../config/compose-memory.js';
import { AuthError, type AuthPort } from './auth.js';
import type { IdentityUser } from './identity-store.js';

async function makeAuth(options?: {
  nowMs?: () => number;
  users?: IdentityUser[];
  jwtSecret?: string;
}): Promise<{ auth: AuthPort; store: MemoryIdentityStore; secret: string }> {
  const secret = options?.jwtSecret ?? 'test-secret-at-least-16';
  const users = options?.users ?? (await buildDemoUsers());
  const store = new MemoryIdentityStore(users);
  const auth = createAuthService({
    jwtSecret: secret,
    identities: store,
    clock: options?.nowMs ? { nowMs: options.nowMs } : undefined,
  });
  return { auth, store, secret };
}

describe('AuthPort C3.5 session transitions', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auth_login_enters_session', async () => {
    const { auth, store } = await makeAuth();
    const tokens = await auth.login({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'hospital_general',
    });

    expect(tokens.token_type).toBe('Bearer');
    expect(tokens.expires_in).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect(tokens.access_token.length).toBeGreaterThan(20);
    expect(tokens.refresh_token.length).toBeGreaterThan(20);

    const user = await store.findUser('hospital@genki.local', 'hospital_general');
    expect(user).not.toBeNull();
    expect(user?.estado).toBe('activo');
    expect(store.activeSessionCount()).toBe(1);

    const principal = await auth.verifyAccessToken(tokens.access_token);
    expect(principal.email).toBe('hospital@genki.local');
    expect(principal.institution_kind).toBe('hospital_general');
    expect(principal.motor).toBe(engineForKind('hospital_general'));
    expect(principal.roles).toContain('administrador');
  });

  it('auth_bad_login_stays_anonymous', async () => {
    const { auth, store } = await makeAuth();

    await expect(
      auth.login({
        email: 'hospital@genki.local',
        password: 'GenkiDev1-wrong',
        institution_kind: 'hospital_general',
      }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' } satisfies Partial<AuthError>);

    await expect(
      auth.login({
        email: 'hospital@genki.local',
        password: 'GenkiDev1',
        institution_kind: 'centro_pediatrico',
      }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' } satisfies Partial<AuthError>);

    const blockedUsers = await buildDemoUsers();
    blockedUsers[0] = { ...blockedUsers[0]!, estado: 'bloqueado' };
    const blocked = await makeAuth({ users: blockedUsers });
    await expect(
      blocked.auth.login({
        email: 'hospital@genki.local',
        password: 'GenkiDev1',
        institution_kind: 'hospital_general',
      }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' } satisfies Partial<AuthError>);

    expect(store.activeSessionCount()).toBe(0);
    expect(blocked.store.activeSessionCount()).toBe(0);
  });

  it('auth_me_valid_session', async () => {
    const { auth } = await makeAuth();
    const tokens = await auth.login({
      email: 'dental@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'clinica_odontologica',
    });
    const principal = await auth.verifyAccessToken(tokens.access_token);
    expect(principal.email).toBe('dental@genki.local');
    expect(principal.institution_kind).toBe('clinica_odontologica');
    expect(principal.motor).toBe('firebase');
    expect(principal.roles).toContain('secretaria');
  });

  it('auth_bad_access_requires_refresh', async () => {
    let now = 1_700_000_000_000;
    const { auth } = await makeAuth({ nowMs: () => now });
    const tokens = await auth.login({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'hospital_general',
    });

    now += (ACCESS_TOKEN_TTL_SECONDS + 5) * 1000;
    await expect(auth.verifyAccessToken(tokens.access_token)).rejects.toMatchObject({
      code: 'invalid_token',
    } satisfies Partial<AuthError>);
    await expect(auth.verifyAccessToken('not-a-jwt')).rejects.toMatchObject({
      code: 'invalid_token',
    } satisfies Partial<AuthError>);

    const refreshed = await auth.refresh(tokens.refresh_token);
    expect(refreshed.access_token.length).toBeGreaterThan(20);
    const principal = await auth.verifyAccessToken(refreshed.access_token);
    expect(principal.institution_kind).toBe('hospital_general');
  });

  it('auth_refresh_rotates_once', async () => {
    const { auth, store } = await makeAuth();
    const first = await auth.login({
      email: 'laboratorio@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'laboratorio_clinico',
    });
    expect(store.activeSessionCount()).toBe(1);

    const second = await auth.refresh(first.refresh_token);
    expect(second.refresh_token).not.toBe(first.refresh_token);
    expect(store.activeSessionCount()).toBe(1);

    await expect(auth.refresh(first.refresh_token)).rejects.toMatchObject({
      code: 'invalid_token',
    } satisfies Partial<AuthError>);

    const third = await auth.refresh(second.refresh_token);
    expect(third.refresh_token).not.toBe(second.refresh_token);
  });

  it('auth_refresh_replay_rejected', async () => {
    const { auth } = await makeAuth();
    const first = await auth.login({
      email: 'pediatrico@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'centro_pediatrico',
    });

    const results = await Promise.allSettled([
      auth.refresh(first.refresh_token),
      auth.refresh(first.refresh_token),
    ]);
    const wins = results.filter((r) => r.status === 'fulfilled');
    const losses = results.filter((r) => r.status === 'rejected');
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect((losses[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'invalid_token',
    });
  });

  it('auth_refresh_expired_rejected', async () => {
    let now = 1_700_000_000_000;
    const { auth } = await makeAuth({ nowMs: () => now });
    const tokens = await auth.login({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'hospital_general',
    });

    now += (REFRESH_TOKEN_TTL_SECONDS + 10) * 1000;
    await expect(auth.refresh(tokens.refresh_token)).rejects.toMatchObject({
      code: 'invalid_token',
    } satisfies Partial<AuthError>);

    const users = await buildDemoUsers();
    const disabled = await makeAuth({ users, nowMs: () => Date.now() });
    const live = await disabled.auth.login({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'hospital_general',
    });
    users[0]!.estado = 'inactivo';
    await expect(disabled.auth.refresh(live.refresh_token)).rejects.toMatchObject({
      code: 'invalid_token',
    } satisfies Partial<AuthError>);
  });

  it('auth_logout_revokes_refresh', async () => {
    const { auth } = await makeAuth();
    const tokens = await auth.login({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'hospital_general',
    });

    await auth.logout(tokens.refresh_token);
    await expect(auth.refresh(tokens.refresh_token)).rejects.toMatchObject({
      code: 'invalid_token',
    } satisfies Partial<AuthError>);

    const principal = await auth.verifyAccessToken(tokens.access_token);
    expect(principal.email).toBe('hospital@genki.local');

    const app = buildHttpApp({
      registry: createPhase0Registry(),
      auth: await createPhase0Auth('test-secret-at-least-16'),
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'hospital@genki.local',
        password: 'GenkiDev1',
        institution_kind: 'hospital_general',
      },
    });
    const body = login.json() as { refresh_token: string; access_token: string };
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: { refresh_token: body.refresh_token },
    });
    expect(logout.statusCode).toBe(204);
    expect(logout.body).toBe('');
  });

  it('auth_logout_idempotent', async () => {
    const { auth } = await makeAuth();
    const tokens = await auth.login({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'hospital_general',
    });
    await auth.logout(tokens.refresh_token);
    await expect(auth.logout(tokens.refresh_token)).resolves.toBeUndefined();
  });

  it('auth_logout_bad_token_rejected', async () => {
    const { auth, store } = await makeAuth();
    const tokens = await auth.login({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'hospital_general',
    });
    const before = store.activeSessionCount();

    await expect(auth.logout('totally-invalid')).rejects.toMatchObject({
      code: 'invalid_token',
    } satisfies Partial<AuthError>);
    expect(store.activeSessionCount()).toBe(before);

    let now = 1_700_000_000_000;
    const timed = await makeAuth({ nowMs: () => now });
    const issued = await timed.auth.login({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'hospital_general',
    });
    now += (REFRESH_TOKEN_TTL_SECONDS + 5) * 1000;
    await expect(timed.auth.logout(issued.refresh_token)).rejects.toMatchObject({
      code: 'invalid_token',
    } satisfies Partial<AuthError>);
    expect(timed.store.activeSessionCount()).toBe(1);
  });

  it('auth_cannot_switch_institution', async () => {
    const { auth, secret } = await makeAuth();
    const tokens = await auth.login({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'hospital_general',
    });

    const principal = await auth.verifyAccessToken(tokens.access_token);
    expect(principal.institution_kind).toBe('hospital_general');
    expect(principal.id_institucion).toBe(1);

    const rotated = await auth.refresh(tokens.refresh_token);
    const after = await auth.verifyAccessToken(rotated.access_token);
    expect(after.institution_kind).toBe('hospital_general');
    expect(after.motor).toBe('postgres');

    const forged = await new SignJWT({
      email: 'hospital@genki.local',
      institucion_id: 2,
      institucion_kind: 'centro_pediatrico',
      roles: ['administrador'],
      motor: 'mysql',
      typ: ACCESS_TOKEN_TYP,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS)
      .sign(new TextEncoder().encode(secret));
    await expect(auth.verifyAccessToken(forged)).rejects.toMatchObject({
      code: 'invalid_token',
    } satisfies Partial<AuthError>);

    // A second login is required to enter another institution.
    const pediatric = await auth.login({
      email: 'pediatrico@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'centro_pediatrico',
    });
    const other = await auth.verifyAccessToken(pediatric.access_token);
    expect(other.institution_kind).toBe('centro_pediatrico');
    expect(other.id_institucion).toBe(2);
  });

  it('enforces password policy on login input', async () => {
    const { auth } = await makeAuth();
    await expect(
      auth.login({
        email: 'hospital@genki.local',
        password: 'short',
        institution_kind: 'hospital_general',
      }),
    ).rejects.toMatchObject({ code: 'password_policy' });
  });
});
