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

/** `NNNN-*-seed-*.sql` files insert demo rows that reference seeded institutions. */
const isDemoDataSql = (name: string): boolean => /-seed-/.test(name);

function hospitalAdminUrl(adminUrl: string): string {
  const url = new URL(adminUrl);
  url.pathname = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).pathname
    : `/${process.env.POSTGRES_DB ?? 'genki_hospital'}`;
  return url.toString();
}

/** Apply the idempotent PostgreSQL demo-data migrations; run after `db:seed`. */
export async function applyPostgresDemoData(): Promise<void> {
  const adminUrl = requireEnv('PG_ADMIN_URL');
  const { readdirSync } = await import('node:fs');
  const pg = await import('pg');
  const dir = join(ROOT, 'server', 'src', 'adapters', 'postgres', 'migrations');
  const client = new pg.default.Client({ connectionString: hospitalAdminUrl(adminUrl) });
  await client.connect();
  try {
    for (const file of readdirSync(dir).filter(isDemoDataSql).sort()) {
      await client.query(readFileSync(join(dir, file), 'utf8'));
    }
  } finally {
    await client.end();
  }
}

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
      const mode = (process.env.FIRESTORE_MODE ?? 'emulator').trim() || 'emulator';
      if (mode !== 'emulator' && mode !== 'real') {
        throw new Error('FIRESTORE_MODE must be emulator or real');
      }
      const project = requireEnv('GCLOUD_PROJECT');
      if (mode === 'real') {
        if (project === 'demo-genki-health' || project.startsWith('demo-')) {
          throw new Error('FIRESTORE_MODE=real requires a non-demo GCLOUD_PROJECT');
        }
        requireEnv('GOOGLE_APPLICATION_CREDENTIALS');
        return;
      }
      requireEnv('FIRESTORE_EMULATOR_HOST');
      if (project !== 'demo-genki-health') {
        throw new Error('FIRESTORE_MODE=emulator requires GCLOUD_PROJECT=demo-genki-health');
      }
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
    // Group roles first: a fresh cluster has none, and the logins below are granted into them.
    for (const role of ROLE_ALLOWLIST.postgres) {
      const found = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
      if ((found.rowCount ?? 0) === 0) await client.query(`CREATE ROLE ${role} NOLOGIN`);
    }
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

  // Table GRANTs must run on the hospital database, not the maintenance DB, and always
  // as the owner/admin principal. DATABASE_URL is the least-privilege runtime login
  // (genki_app_login), which cannot CREATE ROLE / GRANT; only its database name is reused.
  const hospitalUrl = hospitalAdminUrl(adminUrl);
  const hospital = new pg.default.Client({ connectionString: hospitalUrl });
  await hospital.connect();
  try {
    // A fresh database gets the core schema (top-level migrations, in order) exactly once.
    const core = await hospital.query(`SELECT to_regclass('public.paciente') AS t`);
    if (core.rows[0]?.t == null) {
      const { readdirSync } = await import('node:fs');
      const dir = join(ROOT, 'server', 'src', 'adapters', 'postgres', 'migrations');
      for (const file of readdirSync(dir)
        .filter((name) => name.endsWith('.sql') && !isDemoDataSql(name))
        .sort()) {
        await hospital.query(readFileSync(join(dir, file), 'utf8'));
      }
    }
    const securitySql = readFileSync(
      join(ROOT, 'server', 'src', 'adapters', 'postgres', 'security.sql'),
      'utf8',
    );
    await hospital.query(securitySql);
  } finally {
    await hospital.end();
  }
}

async function bootstrapMysql(): Promise<void> {
  const adminUrl = process.env.MYSQL_ADMIN_URL;
  if (!adminUrl) {
    console.log('bootstrap mysql: skipped (MYSQL_ADMIN_URL unset)');
    return;
  }
  const database = process.env.MYSQL_DATABASE ?? 'genki_pediatrico';
  const appPassword = requireEnv('APP_DB_PASSWORD');
  const reportPassword = requireEnv('REPORT_DB_PASSWORD');
  const mysql = await import('mysql2/promise');
  const { installMysqlSecurity } = await import('../server/src/adapters/mysql/security.ts');
  const { readFileSync, readdirSync, existsSync } = await import('node:fs');
  const connection = await mysql.createConnection({ uri: adminUrl, multipleStatements: true });
  try {
    for (const role of ROLE_ALLOWLIST.mysql) {
      await connection.query(`CREATE ROLE IF NOT EXISTS \`${role}\``);
    }
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci`,
    );
    await connection.changeUser({ database });
    const migrationsDir = join(ROOT, 'server/src/adapters/mysql/migrations');
    if (existsSync(migrationsDir)) {
      const [tables] = await connection.query(`SHOW TABLES LIKE 'paciente'`);
      if (!Array.isArray(tables) || tables.length === 0) {
        for (const file of readdirSync(migrationsDir)
          .filter((name) => name.endsWith('.sql'))
          .sort()) {
          await connection.query(readFileSync(join(migrationsDir, file), 'utf8'));
        }
      }
    }
    await installMysqlSecurity(connection, { database, appPassword, reportPassword });
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
  const appPassword = requireEnv('MONGO_APP_PASSWORD');
  const reportPassword = requireEnv('MONGO_REPORT_PASSWORD');
  const { MongoClient } = await import('mongodb');
  const { installMongoSchema } = await import('../server/src/adapters/mongodb/schema.ts');
  const { installMongoSecurity } = await import('../server/src/adapters/mongodb/security.ts');
  const client = new MongoClient(adminUri);
  await client.connect();
  try {
    // Install validators/roles/users in the database the runtime login actually uses.
    const runtimeDb =
      process.env.MONGO_DATABASE ??
      (process.env.MONGODB_URI ? new URL(process.env.MONGODB_URI).pathname.slice(1) : '');
    const db = client.db(runtimeDb || 'genki_laboratorio');
    await db.command({ ping: 1 });
    await installMongoSchema(db);
    await installMongoSecurity(db, { appPassword, reportPassword });
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--demo-data')) {
    await applyPostgresDemoData();
    return;
  }
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
