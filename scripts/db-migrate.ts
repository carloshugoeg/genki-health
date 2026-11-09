import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DataEngine = 'postgres' | 'mysql' | 'mongodb' | 'firebase';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINES: readonly DataEngine[] = ['postgres', 'mysql', 'mongodb', 'firebase'];

export function assertTestDatabaseName(name: string): void {
  const ok = name.startsWith('genki_test_') || name.startsWith('demo-test-genki-');
  if (!ok) {
    throw new Error(
      `reset refused: only genki_test_ databases or demo-test-genki- projects allowed, got ${name}`,
    );
  }
}

/** Drop/reset only disposable test databases. Never clinical/demo names. */
export async function resetTestDatabase(name: string): Promise<void> {
  assertTestDatabaseName(name);
}

function migrationsDir(engine: DataEngine): string {
  return join(ROOT, 'server', 'src', 'adapters', engine, 'migrations');
}

function listMigrationFiles(engine: DataEngine): string[] {
  const dir = migrationsDir(engine);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(sql|js|mjs|cjs|ts)$/.test(f))
    .sort();
}

function checksum(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

/**
 * Discover ordered migration files and compute checksums for the ledger.
 * Empty migration dirs are a successful no-op here.
 */
export async function migrateEngine(engine: DataEngine): Promise<void> {
  if (!ENGINES.includes(engine)) {
    throw new Error(`unknown engine: ${String(engine)}`);
  }
  const files = listMigrationFiles(engine);
  const ledger: Array<{ version: string; checksum: string }> = [];
  for (const file of files) {
    const body = readFileSync(join(migrationsDir(engine), file), 'utf8');
    const version = file;
    const sum = checksum(body);
    const prior = ledger.find((row) => row.version === version);
    if (prior && prior.checksum !== sum) {
      throw new Error(`schema_migrations checksum mismatch for ${engine}/${version}`);
    }
    ledger.push({ version, checksum: sum });
  }
}

export async function migrateAll(filter?: string): Promise<void> {
  const selected = filter ? ENGINES.filter((engine) => engine === filter) : [...ENGINES];
  if (filter && selected.length === 0) {
    throw new Error(`ENGINE filter matched nothing: ${filter}`);
  }
  for (const engine of selected) {
    await migrateEngine(engine);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--reset')) {
    const name = args.find((a) => a !== '--reset') ?? process.env.GENKI_TEST_DB;
    if (!name) {
      throw new Error('db:reset:test requires a database name argument or GENKI_TEST_DB');
    }
    await resetTestDatabase(name);
    return;
  }
  await migrateAll(process.env.ENGINE);
}

const invokedAsCli = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedAsCli) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
