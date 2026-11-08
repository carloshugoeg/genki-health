import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataEngine } from './db-migrate.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Allowlisted owner principals. Passwords come from env; never hardcoded. */
export const ROLE_ALLOWLIST = {
  postgres: ['genki_app', 'genki_identity', 'genki_report'],
  mysql: ['genki_app', 'genki_report'],
  mongodb: ['genkiApp', 'genkiReporter'],
} as const;

const PG_LOGINS = {
  genki_app_login: {
    group: 'genki_app',
    passwordEnv: 'APP_DB_PASSWORD',
  },
  genki_identity_login: {
    group: 'genki_identity',
    passwordEnv: 'IDENTITY_DB_PASSWORD',
  },
  genki_report_login: {
    group: 'genki_report',
    passwordEnv: 'REPORT_DB_PASSWORD',
  },
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env: ${name}`);
  }
  return value;
}

/**
 * Idempotent engine/database/role bootstrap from allowlisted names.
 * Full GRANT matrices live in security.sql / security.ts once those artifacts
 * exist; this entrypoint only creates allowlisted login principals and proves
 * env wiring. Runtime DSNs never receive superuser.
 */
export async function bootstrapEngines(
  engines: DataEngine[] = ['postgres', 'mysql', 'mongodb'],
): Promise<void> {
  for (const engine of engines) {
    await bootstrapEngine(engine);
  }
}

export async function bootstrapEngine(engine: DataEngine): Promise<void> {
  switch (engine) {
    case 'postgres': {
      requireEnv('POSTGRES_PASSWORD');
      requireEnv('APP_DB_PASSWORD');
      requireEnv('IDENTITY_DB_PASSWORD');
      requireEnv('REPORT_DB_PASSWORD');
      await bootstrapPostgres();
      return;
    }
    case 'mysql': {
      requireEnv('MYSQL_ROOT_PASSWORD');
      requireEnv('MYSQL_PASSWORD');
      requireEnv('APP_DB_PASSWORD');
      requireEnv('REPORT_DB_PASSWORD');
      await bootstrapMysql();
      return;
    }
    case 'mongodb': {
      requireEnv('MONGO_ROOT_PASSWORD');
      requireEnv('MONGO_APP_PASSWORD');
      requireEnv('MONGO_REPORT_PASSWORD');
      await bootstrapMongo();
      return;
    }
    case 'firebase': {
      requireEnv('FIRESTORE_EMULATOR_HOST');
      requireEnv('GCLOUD_PROJECT');
      return;
    }
    default: {
      throw new Error(`unknown engine: ${String(engine)}`);
    }
  }
}

async function bootstrapPostgres(): Promise<void> {
  const adminUrl = process.env.PG_ADMIN_URL;
  if (!adminUrl) {
    console.log('bootstrap postgres: skipped (PG_ADMIN_URL unset)');
    return;
  }
  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const securitySql = readFileSync(
      join(ROOT, 'server', 'src', 'adapters', 'postgres', 'security.sql'),
      'utf8',
    );
    await client.query(securitySql);
    for (const [login, meta] of Object.entries(PG_LOGINS)) {
      const password = requireEnv(meta.passwordEnv);
      const passwordLiteral = client.escapeLiteral(password);
      const found = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [login]);
      if ((found.rowCount ?? 0) === 0) {
        await client.query(`CREATE ROLE ${login} LOGIN PASSWORD ${passwordLiteral}`);
      } else {
        await client.query(`ALTER ROLE ${login} WITH LOGIN PASSWORD ${passwordLiteral}`);
      }
      await client.query(`REVOKE ${ROLE_ALLOWLIST.postgres.join(', ')} FROM ${login}`);
      await client.query(`GRANT ${meta.group} TO ${login}`);
    }
  } finally {
    await client.end();
  }
}

async function bootstrapMysql(): Promise<void> {
  const adminUrl = process.env.MYSQL_ADMIN_URL;
  if (!adminUrl) {
    console.log('bootstrap mysql: skipped (MYSQL_ADMIN_URL unset)');
    return;
  }
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection(adminUrl);
  try {
    for (const role of ROLE_ALLOWLIST.mysql) {
      await connection.query(`CREATE ROLE IF NOT EXISTS \`${role}\``);
    }
  } finally {
    await connection.end();
  }
}

async function bootstrapMongo(): Promise<void> {
  const adminUri = process.env.MONGO_ADMIN_URI;
  if (!adminUri) {
    console.log('bootstrap mongodb: skipped (MONGO_ADMIN_URI unset)');
    return;
  }
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(adminUri);
  await client.connect();
  try {
    const db = client.db('genki_laboratorio');
    await db.command({ ping: 1 });
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  const filter = process.env.ENGINE as DataEngine | undefined;
  if (filter) {
    await bootstrapEngine(filter);
  } else {
    await bootstrapEngines();
  }
}

const invokedAsCli = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedAsCli) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
