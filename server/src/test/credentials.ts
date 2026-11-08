import { randomBytes } from 'node:crypto';
import { validatePasswordPolicy } from '@genki/shared';

export interface TestCredentials {
  password: string;
  jwtSecret: string;
}

function randomPassword(): string {
  return `Aa1${randomBytes(12).toString('base64url')}`;
}

function randomJwtSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function installTestCredentials(): void {
  let password = process.env.SEED_PASSWORD?.trim() ?? '';
  if (!password) {
    password = randomPassword();
    process.env.SEED_PASSWORD = password;
  }
  const policy = validatePasswordPolicy(password);
  if (policy) {
    throw new Error(`SEED_PASSWORD violates policy: ${policy}`);
  }

  let jwtSecret = process.env.JWT_SECRET?.trim() ?? '';
  if (jwtSecret.length < 16) {
    jwtSecret = randomJwtSecret();
    process.env.JWT_SECRET = jwtSecret;
  }
}

export function testCredentials(): TestCredentials {
  const password = process.env.SEED_PASSWORD?.trim() ?? '';
  const jwtSecret = process.env.JWT_SECRET?.trim() ?? '';
  if (!password || jwtSecret.length < 16) {
    throw new Error('test credentials missing; call installTestCredentials() first');
  }
  return { password, jwtSecret };
}
