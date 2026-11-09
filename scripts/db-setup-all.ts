/**
 * Idempotent full local DB setup across core + lane A (charges) + lane B (agenda).
 * Order: bootstrap → core migrate → module migrate → bootstrap (GRANTs) → seeds.
 * Honors FIRESTORE_MODE=real; does not force the emulator.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINES = ['postgres', 'mysql', 'mongodb', 'firebase'] as const;

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
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

  await run('npm', ['run', 'db:bootstrap']);
  await run('npm', ['run', 'db:migrate']);

  for (const engine of ENGINES) {
    await run('npx', ['tsx', 'server/test/full/charges/manage.ts', 'migrate', engine]);
  }
  await run('npx', ['tsx', 'server/test/full/agenda/manage.ts', 'migrate']);

  await run('npm', ['run', 'db:bootstrap']);

  await run('npm', ['run', 'db:seed']);
  for (const engine of ENGINES) {
    await run('npx', ['tsx', 'server/test/full/charges/manage.ts', 'seed', engine]);
  }
  await run('npx', ['tsx', 'server/test/full/agenda/manage.ts', 'seed']);

  console.log('db:setup:all OK');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
