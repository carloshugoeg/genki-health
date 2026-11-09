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
  if (options.jwtSecret.length < 32) throw new Error('JWT_SECRET requires at least 32 characters');
  const pool = new pg.Pool({
    connectionString: options.url,
    max: 5,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  try {
    const role = await pool.query<{ safe: boolean }>(`SELECT current_user='genki_identity_login'
      AND pg_has_role(current_user,'genki_identity','member') AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb
      AND NOT has_table_privilege(current_user,'paciente','SELECT') AS safe FROM pg_roles WHERE rolname=current_user`);
    if (!role.rows[0]?.safe) throw new Error('Hospital PG identity role mismatch');
    await pool.query(`SELECT u.id_usuario,u.correo,u.hash_contrasena,u.estado,i.tipo,i.motor_datos,r.nombre,
      s.jti_hash,s.expires_at,s.created_at,s.revoked_at FROM usuario u JOIN institucion i USING (id_institucion)
      JOIN rol r USING (id_rol) LEFT JOIN auth_session s USING (id_usuario) LIMIT 0`);
  } catch {
    await pool.end().catch(() => undefined);
    throw new Error('Hospital PG identity role/schema unavailable');
  }

  let closing: Promise<void> | undefined;
  return {
    auth: createAuthService({
      jwtSecret: options.jwtSecret,
      identities: new PostgresIdentityStore(pool),
    }),
    async close(): Promise<void> {
      await (closing ??= pool.end());
    },
  };
}
