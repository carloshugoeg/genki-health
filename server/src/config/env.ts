import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { validatePasswordPolicy } from '@genki/shared';

interface BaseEnv {
  mode: 'memory' | 'engines';
  jwtSecret: string;
  host: string;
  port: number;
}
export interface EnginesEnv extends BaseEnv {
  mode: 'engines';
  databaseUrl: string;
  authDatabaseUrl: string;
  mysqlUrl: string;
  mongodbUri: string;
  emulatorHost: string;
  projectId: string;
}
export type RuntimeEnv = EnginesEnv | (BaseEnv & { mode: 'memory' });
function required(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name];
  if (!value?.trim()) throw new Error(`Missing required env: ${name}`);
  return value;
}
function database(source: NodeJS.ProcessEnv, name: string, protocol: string[], user: string): URL {
  let url: URL;
  try {
    url = new URL(required(source, name));
  } catch {
    throw new Error(`Invalid or missing ${name}`);
  }
  const allowed =
    name === 'MONGODB_URI'
      ? ['authSource', 'replicaSet', 'directConnection']
      : name === 'MYSQL_URL'
        ? []
        : ['sslmode'];
  if (
    !protocol.includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/[a-zA-Z0-9_]+$/.test(url.pathname) ||
    decodeURIComponent(url.username) !== user ||
    !url.password ||
    [...url.searchParams.keys()].some((key) => !allowed.includes(key))
  )
    throw new Error(
      `${name} requires an existing loopback demo database and its least-privilege login`,
    );
  return url;
}
export function readEnv(source: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  const mode = source.GENKI_MODE ?? 'memory';
  if (mode !== 'memory' && mode !== 'engines')
    throw new Error('GENKI_MODE must be memory or engines');
  const jwtSecret = required(source, 'JWT_SECRET');
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET requires at least 32 characters');
  const host = source.API_HOST ?? '127.0.0.1';
  const port = Number(source.API_PORT ?? '3000');
  if (
    !['127.0.0.1', 'localhost', '::1'].includes(host) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw new Error('Invalid loopback API_HOST or API_PORT');
  if (mode === 'memory') {
    if (validatePasswordPolicy(required(source, 'SEED_PASSWORD')))
      throw new Error('SEED_PASSWORD violates password_policy');
    return { mode, jwtSecret, host, port };
  }
  const pg = database(source, 'DATABASE_URL', ['postgres:', 'postgresql:'], 'genki_app_login');
  const auth = database(
    source,
    'AUTH_DATABASE_URL',
    ['postgres:', 'postgresql:'],
    'genki_identity_login',
  );
  if (
    pg.hostname !== auth.hostname ||
    (pg.port || '5432') !== (auth.port || '5432') ||
    pg.pathname !== auth.pathname
  )
    throw new Error(
      'AUTH_DATABASE_URL must use the same Hospital PG database with the separate identity login',
    );
  const mysql = database(source, 'MYSQL_URL', ['mysql:'], 'genki_app_login');
  const mongo = database(source, 'MONGODB_URI', ['mongodb:'], 'genkiApp');
  mongo.searchParams.set('directConnection', 'true');
  const firestoreMode = (source.FIRESTORE_MODE ?? 'emulator').trim() || 'emulator';
  if (firestoreMode !== 'emulator' && firestoreMode !== 'real')
    throw new Error('FIRESTORE_MODE must be emulator or real');
  const projectId = required(source, 'GCLOUD_PROJECT');
  const emulatorHost = (source.FIRESTORE_EMULATOR_HOST ?? '').trim();
  if (firestoreMode === 'emulator') {
    if (
      !emulatorHost ||
      !/^(127\.0\.0\.1|localhost|\[::1\]):[0-9]+$/.test(emulatorHost) ||
      projectId !== 'demo-genki-health'
    )
      throw new Error('Firestore requires the loopback emulator and demo-genki-health project');
  } else if (
    !projectId ||
    projectId === 'demo-genki-health' ||
    /^demo-[a-z0-9-]+$/.test(projectId)
  ) {
    throw new Error('FIRESTORE_MODE=real requires a non-demo GCLOUD_PROJECT');
  }
  return {
    mode,
    jwtSecret,
    host,
    port,
    databaseUrl: pg.toString(),
    authDatabaseUrl: auth.toString(),
    mysqlUrl: mysql.toString(),
    mongodbUri: mongo.toString(),
    emulatorHost,
    projectId,
  };
}
export function loadEnv(): RuntimeEnv {
  dotenv.config({
    path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'),
    override: false,
  });
  return readEnv();
}
