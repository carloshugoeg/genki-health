import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { PostgresEconomicStore } from '../../../src/adapters/postgres/full/charges.js';
import { MysqlEconomicStore } from '../../../src/adapters/mysql/full/charges.js';
import { MongodbEconomicStore } from '../../../src/adapters/mongodb/full/charges.js';
import { FirebaseEconomicStore } from '../../../src/adapters/firebase/full/charges.js';
import type { EconomicReferences, EconomicStore } from '../../../src/ports/full/charges.js';
import { seedCharges } from './fixtures.js';
import { seedPersonnel } from '../personnel/fixtures.js';
import { seedInventory } from '../inventory/fixtures.js';
import { seedHonoraria } from '../honoraria/fixtures.js';
export const engines = ['postgres', 'mysql', 'mongodb', 'firebase'] as const;
export type Engine = (typeof engines)[number];
export const modules = ['charges', 'personnel', 'inventory', 'honoraria', 'invoicing', 'payments'];
export async function seed(store: EconomicStore) {
  for (const fn of [seedCharges, seedPersonnel, seedInventory, seedHonoraria]) await fn(store);
}
/** CLI only: no fallback credentials and no fallback engine. References come from future clinical wiring. */
export async function connect(
  engine: Engine,
  references: EconomicReferences = { patient: async () => null, act: async () => null },
) {
  if (engine === 'postgres') {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    return {
      store: new PostgresEconomicStore(pool, 1, references),
      close: () => pool.end(),
      migrate: async () => {
        for (const module of modules)
          await pool.query(
            await readFile(
              fileURLToPath(
                new URL(
                  `../../../src/adapters/postgres/full/${module}/migrations/001.sql`,
                  import.meta.url,
                ),
              ),
              'utf8',
            ),
          );
      },
    };
  }
  if (engine === 'mysql') {
    if (!process.env.MYSQL_URL) throw new Error('MYSQL_URL required');
    const pool = mysql.createPool(process.env.MYSQL_URL);
    return {
      store: new MysqlEconomicStore(pool, 2, references),
      close: () => pool.end(),
      migrate: async () => {
        for (const module of modules) {
          const sql = await readFile(
            fileURLToPath(
              new URL(
                `../../../src/adapters/mysql/full/${module}/migrations/001.sql`,
                import.meta.url,
              ),
            ),
            'utf8',
          );
          for (const statement of sql
            .split(';')
            .map((x) => x.trim())
            .filter(Boolean))
            await pool.query(statement);
        }
      },
    };
  }
  if (engine === 'mongodb') {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
    const client = await new MongoClient(process.env.MONGODB_URI).connect();
    const store = new MongodbEconomicStore(client, client.db(), 3, references);
    return { store, close: () => client.close(), migrate: () => store.migrate() };
  }
  const real = process.env.FIRESTORE_MODE === 'real',
    projectId = process.env.FIREBASE_PROJECT_ID;
  if (
    !projectId ||
    (real
      ? projectId.startsWith('demo-') || !!process.env.FIRESTORE_EMULATOR_HOST
      : !projectId.startsWith('demo-') ||
        !/^(127\.0\.0\.1|localhost):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ''))
  )
    throw new Error('Explicit Firestore mode/project configuration required');
  const app = initializeApp(
      real ? { projectId, credential: applicationDefault() } : { projectId },
      `lane-a-${randomUUID()}`,
    ),
    db = getFirestore(app);
  const store = new FirebaseEconomicStore(db, 4, references);
  return {
    store,
    close: async () => {
      await db.terminate();
      await deleteApp(app);
    },
    migrate: async () => {
      /* Documents and collections created atomically on first write. */
    },
  };
}
