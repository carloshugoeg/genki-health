/**
 * Idempotent full local DB setup across core + lane A/B + OP37 procedure + FS-19 dental-session.
 * Order: bootstrap → core migrate → module migrate → bootstrap (GRANTs) → seeds.
 * Honors FIRESTORE_MODE=real; does not force the emulator.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINES = ['postgres', 'mysql', 'mongodb', 'firebase'] as const;

/**
 * DDL must run as the owner principals, never the least-privilege runtime logins
 * (genki_app_login cannot CREATE in schema public after security.sql revokes it).
 * Module migrate CLIs read the runtime variable names, so point those at the admin URLs
 * (same host/database) only for the migrate steps. Seeds keep the runtime env.
 */
function ownerEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (process.env.PG_ADMIN_URL) {
    const owner = new URL(process.env.PG_ADMIN_URL);
    if (process.env.DATABASE_URL) owner.pathname = new URL(process.env.DATABASE_URL).pathname;
    env.DATABASE_URL = owner.toString();
  }
  if (process.env.MYSQL_ADMIN_URL) {
    const owner = new URL(process.env.MYSQL_ADMIN_URL);
    if (process.env.MYSQL_URL) owner.pathname = new URL(process.env.MYSQL_URL).pathname;
    env.MYSQL_URL = owner.toString();
  }
  if (process.env.MONGO_ADMIN_URI) {
    const runtimeDb = process.env.MONGODB_URI
      ? new URL(process.env.MONGODB_URI).pathname.slice(1)
      : new URL(process.env.MONGO_ADMIN_URI).pathname.slice(1);
    const owner = new URL(process.env.MONGO_ADMIN_URI);
    if (runtimeDb) owner.pathname = `/${runtimeDb}`;
    env.MONGODB_URI = owner.toString();
    env.MONGO_URL = owner.toString();
    if (runtimeDb && !process.env.MONGO_DATABASE) env.MONGO_DATABASE = runtimeDb;
  }
  return env;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: 'inherit',
      env,
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited ${code ?? 'null'}`));
    });
  });
}

async function main(): Promise<void> {
  const mode = (process.env.FIRESTORE_MODE ?? 'emulator').trim() || 'emulator';
  if (mode !== 'emulator' && mode !== 'real') {
    throw new Error('FIRESTORE_MODE must be emulator or real');
  }

  const owner = ownerEnv();
  await run('npm', ['run', 'db:bootstrap']);
  await run('npm', ['run', 'db:migrate']);

  for (const engine of ENGINES) {
    await run('npx', ['tsx', 'server/test/full/charges/manage.ts', 'migrate', engine], owner);
  }
  await run('npx', ['tsx', 'server/test/full/agenda/manage.ts', 'migrate'], owner);
  await run('npx', ['tsx', 'server/test/full/procedure/manage.ts', 'migrate', 'postgres'], owner);
  await run('npx', ['tsx', 'server/test/full/dental-session/manage.ts', 'migrate'], owner);
  await run('npx', ['tsx', 'server/test/full/lane3/manage.ts', 'migrate'], owner);

  await run('npm', ['run', 'db:bootstrap']);

  await run('npm', ['run', 'db:seed']);
  for (const engine of ENGINES) {
    await run('npx', ['tsx', 'server/test/full/charges/manage.ts', 'seed', engine]);
  }
  await run('npx', ['tsx', 'server/test/full/agenda/manage.ts', 'seed']);
  // procedure "seed" re-applies its idempotent DDL+catalog file, so it also needs the owner.
  await run('npx', ['tsx', 'server/test/full/procedure/manage.ts', 'seed', 'postgres'], owner);
  await run('npx', ['tsx', 'server/test/full/dental-session/manage.ts', 'seed']);

  console.log('db:setup:all OK');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
