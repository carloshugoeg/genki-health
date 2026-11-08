import pg from 'pg';
import { createAuthService } from '../adapters/auth/service.js';
import { PostgresIdentityStore } from '../adapters/postgres/identity-store.js';
import type { AuthPort } from '../ports/auth.js';

export interface PostgresAuthOptions {
  url: string;
  jwtSecret: string;
}

export interface PostgresAuthResource {
  auth: AuthPort;
  close(): Promise<void>;
}

/** Live identity composition: all institutions authenticate against Hospital PostgreSQL. */
export async function createPostgresAuth(
  options: PostgresAuthOptions,
): Promise<PostgresAuthResource> {
  const pool = new pg.Pool({ connectionString: options.url, max: 5 });
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    await pool.end().catch(() => undefined);
    throw error;
  }

  return {
    auth: createAuthService({
      jwtSecret: options.jwtSecret,
      identities: new PostgresIdentityStore(pool),
    }),
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
