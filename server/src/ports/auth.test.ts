import { describe, expect, it } from 'vitest';
import { ACCESS_TOKEN_TTL_SECONDS, engineForKind } from '@genki/shared';
import { MemoryAuthAdapter } from '../adapters/memory/auth.js';
import { AuthError } from './auth.js';

describe('MemoryAuthAdapter', () => {
  it('logs in with email, password, and matching institution', async () => {
    const auth = await MemoryAuthAdapter.create({
      jwtSecret: 'test-secret-at-least-16',
    });
    const tokens = await auth.login({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'hospital_general',
    });

    expect(tokens.token_type).toBe('Bearer');
    expect(tokens.expires_in).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect(tokens.access_token.length).toBeGreaterThan(20);
    expect(tokens.refresh_token.length).toBeGreaterThan(20);

    const principal = await auth.verifyAccessToken(tokens.access_token);
    expect(principal.email).toBe('hospital@genki.local');
    expect(principal.institution_kind).toBe('hospital_general');
    expect(principal.motor).toBe(engineForKind('hospital_general'));
    expect(principal.roles).toContain('administrador');
  });

  it('rejects wrong institution for the same email', async () => {
    const auth = await MemoryAuthAdapter.create({
      jwtSecret: 'test-secret-at-least-16',
    });
    await expect(
      auth.login({
        email: 'hospital@genki.local',
        password: 'GenkiDev1',
        institution_kind: 'centro_pediatrico',
      }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' } satisfies Partial<AuthError>);
  });

  it('rejects bad password', async () => {
    const auth = await MemoryAuthAdapter.create({
      jwtSecret: 'test-secret-at-least-16',
    });
    await expect(
      auth.login({
        email: 'hospital@genki.local',
        password: 'GenkiDev1-wrong',
        institution_kind: 'hospital_general',
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('rotates refresh tokens', async () => {
    const auth = await MemoryAuthAdapter.create({
      jwtSecret: 'test-secret-at-least-16',
    });
    const first = await auth.login({
      email: 'dental@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'clinica_odontologica',
    });
    const second = await auth.refresh(first.refresh_token);
    expect(second.refresh_token).not.toBe(first.refresh_token);
    await expect(auth.refresh(first.refresh_token)).rejects.toBeInstanceOf(AuthError);
    const principal = await auth.verifyAccessToken(second.access_token);
    expect(principal.motor).toBe('firebase');
    const third = await auth.refresh(second.refresh_token);
    expect(third.refresh_token).not.toBe(second.refresh_token);
  });

  it('enforces password policy on login input', async () => {
    const auth = await MemoryAuthAdapter.create({
      jwtSecret: 'test-secret-at-least-16',
    });
    await expect(
      auth.login({
        email: 'hospital@genki.local',
        password: 'short',
        institution_kind: 'hospital_general',
      }),
    ).rejects.toMatchObject({ code: 'password_policy' });
  });
});
