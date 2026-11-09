import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connection } from 'mysql2/promise';

export const MYSQL_APP_ROLE = 'genki_app' as const;
export const MYSQL_REPORT_ROLE = 'genki_report' as const;
export const MYSQL_APP_USER = 'genki_app_login' as const;
export const MYSQL_REPORT_USER = 'genki_report_login' as const;
export const MYSQL_REPORT_VIEW = 'reporte_pacientes' as const;
export const MYSQL_LOGIN_HOST = '%' as const;

export type MysqlSecuritySecrets = {
  database: string;
  appPassword: string;
  reportPassword: string;
};

const SECURITY_SQL_PATH = join(dirname(fileURLToPath(import.meta.url)), 'security.sql');

const ROLE_ALLOWLIST = new Set<string>([MYSQL_APP_ROLE, MYSQL_REPORT_ROLE]);
const USER_ALLOWLIST = new Set<string>([MYSQL_APP_USER, MYSQL_REPORT_USER]);
const DB_NAME_PATTERN = /^[A-Za-z0-9_]+$/;

function assertAllowlistedDatabase(database: string): string {
  if (!DB_NAME_PATTERN.test(database)) {
    throw new Error(`installMysqlSecurity: database name rejected: ${database}`);
  }
  return database;
}

function assertAllowlistedUser(user: string): typeof MYSQL_APP_USER | typeof MYSQL_REPORT_USER {
  if (!USER_ALLOWLIST.has(user)) {
    throw new Error(`installMysqlSecurity: user rejected: ${user}`);
  }
  return user as typeof MYSQL_APP_USER | typeof MYSQL_REPORT_USER;
}

function assertAllowlistedRole(role: string): typeof MYSQL_APP_ROLE | typeof MYSQL_REPORT_ROLE {
  if (!ROLE_ALLOWLIST.has(role)) {
    throw new Error(`installMysqlSecurity: role rejected: ${role}`);
  }
  return role as typeof MYSQL_APP_ROLE | typeof MYSQL_REPORT_ROLE;
}

function escapeMysqlLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

async function upsertLogin(
  connection: Connection,
  user: typeof MYSQL_APP_USER | typeof MYSQL_REPORT_USER,
  password: string,
  role: typeof MYSQL_APP_ROLE | typeof MYSQL_REPORT_ROLE,
): Promise<void> {
  const safeUser = assertAllowlistedUser(user);
  const safeRole = assertAllowlistedRole(role);
  const passwordLiteral = escapeMysqlLiteral(password);
  await connection.query(
    `CREATE USER IF NOT EXISTS '${safeUser}'@'${MYSQL_LOGIN_HOST}' IDENTIFIED BY ${passwordLiteral}`,
  );
  await connection.query(
    `ALTER USER '${safeUser}'@'${MYSQL_LOGIN_HOST}' IDENTIFIED BY ${passwordLiteral}`,
  );
  await connection.query(`GRANT \`${safeRole}\` TO '${safeUser}'@'${MYSQL_LOGIN_HOST}'`);
  await connection.query(`SET DEFAULT ROLE \`${safeRole}\` TO '${safeUser}'@'${MYSQL_LOGIN_HOST}'`);
}

/**
 * C5.3 MySQL least-privilege roles, report view grants, and login users.
 * Passwords come from env via the caller; never hardcoded.
 */
export async function installMysqlSecurity(
  connection: Connection,
  secrets: MysqlSecuritySecrets,
): Promise<void> {
  if (!secrets.appPassword || !secrets.reportPassword) {
    throw new Error('installMysqlSecurity requires appPassword and reportPassword');
  }
  const database = assertAllowlistedDatabase(secrets.database);
  const sql = readFileSync(SECURITY_SQL_PATH, 'utf8').replaceAll('__DATABASE__', database);
  const statements = sql
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  for (const statement of statements) {
    try {
      await connection.query(statement);
    } catch (error) {
      const errno =
        typeof error === 'object' && error !== null && 'errno' in error
          ? Number((error as { errno: number }).errno)
          : 0;
      // These tables are created by later module migrations, so the first bootstrap can run before they exist.
      const optionalModule =
        /\b(lane_a_\w+|agenda_cita|agenda_lock|agenda_cita_id|reactivacion_audit|bitacora)\b/.test(
          statement,
        ) && errno === 1146;
      if (!optionalModule) throw error;
    }
  }
  await upsertLogin(connection, MYSQL_APP_USER, secrets.appPassword, MYSQL_APP_ROLE);
  await upsertLogin(connection, MYSQL_REPORT_USER, secrets.reportPassword, MYSQL_REPORT_ROLE);
  await connection.query('FLUSH PRIVILEGES');
}

/** Build a mysql:// URL for an app/report principal against a database. */
export function mysqlAuthenticatedUrl(options: {
  adminUrl: string;
  database: string;
  user: typeof MYSQL_APP_USER | typeof MYSQL_REPORT_USER;
  password: string;
}): string {
  const database = assertAllowlistedDatabase(options.database);
  const user = assertAllowlistedUser(options.user);
  const parsed = new URL(options.adminUrl);
  const host = parsed.hostname || '127.0.0.1';
  const port = parsed.port || '3306';
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(options.password);
  return `mysql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
}
