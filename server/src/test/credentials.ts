import { randomBytes } from 'node:crypto';
import { validatePasswordPolicy } from '@genki/shared';

export interface TestCredentials {
  password: string;
  jwtSecret: string;
}

let cached: TestCredentials | null = null;

function randomPassword(): string {
  return `Aa1${randomBytes(12).toString('base64url')}`;
}

function randomJwtSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** Process-local password + JWT secret for tests. Env wins; else node:crypto once. */
export function ensureTestCredentials(): TestCredentials {
  if (cached) {
    return cached;
  }

  const fromEnv = process.env.SEED_PASSWORD?.trim();
  const password = fromEnv && fromEnv.length > 0 ? fromEnv : randomPassword();
  const policy = validatePasswordPolicy(password);
  if (policy) {
    throw new Error(`SEED_PASSWORD violates policy: ${policy}`);
  }

  const secretEnv = process.env.JWT_SECRET?.trim();
  const jwtSecret = secretEnv && secretEnv.length >= 16 ? secretEnv : randomJwtSecret();

  process.env.SEED_PASSWORD = password;
  process.env.JWT_SECRET = jwtSecret;
  cached = { password, jwtSecret };
  return cached;
}
