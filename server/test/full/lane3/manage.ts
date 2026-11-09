/**
 * Idempotent lane-3 migrations for account/users (PG) and OP-19 audit (PG/MySQL/Mongo/Firestore).
 * Wired from `npm run db:setup:all`. Honors FIRESTORE_MODE=real (does not force emulator).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const [command = 'migrate', engineArg] = process.argv.slice(2);

if (command !== 'migrate') {
  throw new Error('Uso: manage.ts migrate [postgres|mysql|mongodb|firebase]');
}

const engines = (engineArg ? [engineArg] : ['postgres', 'mysql', 'mongodb', 'firebase']) as const;

async function migratePostgres(): Promise<void> {
  const url = process.env.DATABASE_URL ?? process.env.PG_ADMIN_URL;
  if (!url) {
    console.log('lane3 postgres: skipped (DATABASE_URL/PG_ADMIN_URL unset)');
    return;
  }
  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString: url });
  await client.connect();
  try {
    const dir = join(ROOT, 'src/adapters/postgres/migrations/full');
    for (const file of readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      await client.query(readFileSync(join(dir, file), 'utf8'));
      console.log(`postgres: applied ${file}`);
    }
  } finally {
    await client.end();
  }
}

async function migrateMysql(): Promise<void> {
  const url = process.env.MYSQL_URL ?? process.env.MYSQL_ADMIN_URL;
  if (!url) {
    console.log('lane3 mysql: skipped (MYSQL_URL/MYSQL_ADMIN_URL unset)');
    return;
  }
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection({ uri: url, multipleStatements: true });
  try {
    const dir = join(ROOT, 'src/adapters/mysql/migrations/full');
    for (const file of readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      await connection.query(readFileSync(join(dir, file), 'utf8'));
      console.log(`mysql: applied ${file}`);
    }
  } finally {
    await connection.end();
  }
}

async function migrateMongodb(): Promise<void> {
  const uri = process.env.MONGO_URL ?? process.env.MONGO_ADMIN_URI;
  if (!uri) {
    console.log('lane3 mongodb: skipped (MONGO_URL/MONGO_ADMIN_URI unset)');
    return;
  }
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(process.env.MONGO_DATABASE ?? 'genki_laboratorio');
    await db
      .collection('reactivacion_audit')
      .createIndex({ institution_id: 1, id: 1 }, { unique: true, name: 'uq_reactivacion_audit' });
    console.log('mongodb: ensured reactivacion_audit');
  } finally {
    await client.close();
  }
}

async function migrateFirebase(): Promise<void> {
  const mode = (process.env.FIRESTORE_MODE ?? 'emulator').trim() || 'emulator';
  if (mode !== 'emulator' && mode !== 'real') {
    throw new Error('FIRESTORE_MODE must be emulator or real');
  }
  const project = process.env.GCLOUD_PROJECT;
  if (!project) {
    console.log('lane3 firebase: skipped (GCLOUD_PROJECT unset)');
    return;
  }
  if (mode === 'emulator') {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      console.log('lane3 firebase: skipped (FIRESTORE_EMULATOR_HOST unset)');
      return;
    }
  } else {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('lane3 firebase: skipped (GOOGLE_APPLICATION_CREDENTIALS unset for real)');
      return;
    }
  }
  const { applicationDefault, initializeApp, getApps, deleteApp } =
    await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app =
    getApps()[0] ??
    initializeApp({
      credential: applicationDefault(),
      projectId: project,
    });
  try {
    const db = getFirestore(app);
    const marker = db
      .collection('institutions')
      .doc('4')
      .collection('reactivacion_audit')
      .doc('_ensure');
    await marker.set({ ensured_at: new Date().toISOString(), lane: 'lane3' }, { merge: true });
    console.log(`firebase(${mode}): ensured reactivacion_audit`);
  } finally {
    const shouldKeep =
      !getApps().length || (existsSync('/tmp') && !process.env.LANE3_DELETE_FIREBASE_APP);
    if (!shouldKeep) {
      await deleteApp(app).catch(() => undefined);
    }
  }
}

for (const engine of engines) {
  if (engine === 'postgres') await migratePostgres();
  else if (engine === 'mysql') await migrateMysql();
  else if (engine === 'mongodb') await migrateMongodb();
  else if (engine === 'firebase') await migrateFirebase();
  else throw new Error(`unknown engine: ${engine}`);
  console.log(`lane3 ${engine}: migrate OK`);
}
