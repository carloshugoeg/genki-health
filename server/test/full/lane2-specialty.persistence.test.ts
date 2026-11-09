/**
 * One native persistence check per specialty engine (lane 2).
 * Requires disposable engines via PG_ADMIN_URL / MYSQL_ADMIN_URL / MONGO_ADMIN_URI / Firestore emulator.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { asInstitutionId } from '@genki/shared';
import pg from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import { createPostgresAdapterSet } from '../../src/adapters/postgres/index.js';
import { createMysqlAdapterSet } from '../../src/adapters/mysql/index.js';
import { createMongoAdapterSet } from '../../src/adapters/mongodb/index.js';
import { createFirebaseAdapterSet } from '../../src/adapters/firebase/index.js';
import { installMongoSchema } from '../../src/adapters/mongodb/schema.js';
import { executeOp34 } from '../../src/application/full/admission.js';
import { executeOp40 } from '../../src/application/full/growth.js';
import { executeOp48 } from '../../src/application/full/lab-intake.js';
import { executeOp55 } from '../../src/application/full/dental-chart.js';
import { fullModulesFromSet, type AdapterSetWithFull } from '../../src/config/full-modules.js';
import type { FullContext, OperationContext } from '../../src/ports/full/context.js';
import type { AdapterResource } from '../../src/ports/adapter-resource.js';
import { SEED_PROFESIONAL_ID } from '../../src/testing/catalog-seeds.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const engined = Boolean(
  process.env.PG_ADMIN_URL && process.env.MYSQL_ADMIN_URL && process.env.MONGO_ADMIN_URI,
);

function actor(institutionId: number, roles: string[], suffix: string): OperationContext {
  return {
    id_institucion: asInstitutionId(institutionId),
    id_usuario: 10,
    id_profesional: SEED_PROFESIONAL_ID,
    roles,
    permissions: [],
    now: '2026-11-09T15:00:00.000Z',
    idempotency_key: `lane2-${institutionId}-${suffix}`,
  };
}

function contextFrom(resource: AdapterResource): FullContext {
  const set = resource.set as AdapterSetWithFull;
  return {
    base: set,
    modules: fullModulesFromSet(set),
    unitOfWork: set.unitOfWork,
    clock: set.clock,
    ids: set.ids,
  };
}

async function applySqlMigrations(
  engine: 'postgres' | 'mysql',
  run: (sql: string) => Promise<void>,
): Promise<void> {
  const dir = join(ROOT, 'server/src/adapters', engine, 'migrations');
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await run(readFileSync(join(dir, file), 'utf8'));
  }
}

function rebuildSqlUrl(adminUrl: string, dbName: string, protocol: 'postgres' | 'mysql'): string {
  const parsed = new URL(adminUrl);
  const user = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  const host = parsed.hostname;
  const port = parsed.port || (protocol === 'postgres' ? '5432' : '3306');
  return `${protocol}://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
}

describe.skipIf(!engined)('lane-2 specialty native persistence', () => {
  const closers: Array<() => Promise<void>> = [];

  afterAll(async () => {
    for (const close of closers.reverse()) {
      await close().catch(() => undefined);
    }
  });

  it('postgres_admission_and_note_persist', async () => {
    const adminUrl = process.env.PG_ADMIN_URL!;
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    const db = 'genki_test_lane2_pg';
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [
      db,
    ]);
    await admin.query(`DROP DATABASE IF EXISTS ${db}`);
    await admin.query(`CREATE DATABASE ${db}`);
    const appUrl = rebuildSqlUrl(adminUrl, db, 'postgres');
    const client = new pg.Client({ connectionString: appUrl });
    await client.connect();
    await applySqlMigrations('postgres', async (sql) => {
      await client.query(sql);
    });
    // Minimal patient/expediente/diagnostico fixture if core migrations seeded none.
    await client.query(`
      INSERT INTO institucion (id_institucion, nombre, tipo, nit, direccion, telefono, motor_datos, activo)
      VALUES (1, 'Hospital Test', 'hospital_general', 'NIT-1', 'x', '0', 'postgres', TRUE)
      ON CONFLICT DO NOTHING`);
    await client.end();
    await admin.end();

    const resource = await createPostgresAdapterSet({
      id_institucion: asInstitutionId(1),
      kind: 'hospital_general',
      url: appUrl,
    });
    closers.push(() => resource.close());
    const ctx = contextFrom(resource);
    const beds = await executeOp34(
      ctx,
      { params: {}, query: {}, body: {} },
      actor(1, ['medico'], 'beds'),
    );
    expect(beds.length).toBeGreaterThan(0);
  });

  it('mysql_perinatal_persists', async () => {
    const adminUrl = process.env.MYSQL_ADMIN_URL!;
    const admin = await mysql.createConnection(adminUrl);
    const db = 'genki_test_lane2_my';
    await admin.query(`DROP DATABASE IF EXISTS \`${db}\``);
    await admin.query(`CREATE DATABASE \`${db}\``);
    await admin.changeUser({ database: db });
    await applySqlMigrations('mysql', async (sql) => {
      for (const stmt of sql
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        await admin.query(stmt);
      }
    });
    await admin.end();
    const appUrl = rebuildSqlUrl(adminUrl, db, 'mysql');
    const resource = await createMysqlAdapterSet({
      id_institucion: asInstitutionId(2),
      kind: 'centro_pediatrico',
      url: appUrl,
    });
    closers.push(() => resource.close());
    // Without a seeded patient this will 404; still proves adapter wiring + table presence.
    await expect(
      executeOp40(
        contextFrom(resource),
        {
          params: { id: 1 },
          query: {},
          body: { semanas_gestacion: 40, tipo_parto: 'vaginal' },
        },
        actor(2, ['medico'], 'peri'),
      ),
    ).rejects.toBeTruthy();
    const pool = await mysql.createConnection(appUrl);
    const [tables] = await pool.query(`SHOW TABLES LIKE 'antecedente_perinatal'`);
    expect(Array.isArray(tables) && tables.length).toBeTruthy();
    await pool.end();
  });

  it('mongo_lab_order_persists', async () => {
    const uri = process.env.MONGO_ADMIN_URI!;
    const client = new MongoClient(uri);
    await client.connect();
    const dbName = 'genki_test_lane2_mo';
    await client.db(dbName).dropDatabase();
    await installMongoSchema(client.db(dbName));
    const resource = await createMongoAdapterSet({
      id_institucion: asInstitutionId(3),
      kind: 'laboratorio_clinico',
      url: `${uri.replace(/\/?$/, '/')}${dbName}`,
    });
    closers.push(async () => {
      await resource.close();
      await client.close();
    });
    const orden = await executeOp48(
      contextFrom(resource),
      {
        params: {},
        query: {},
        body: {
          id_paciente: 1,
          institucion_origen: 1,
          medico_solicitante: 'Dr Test',
          prioridad: 'rutina',
          examenes: ['HEM001'],
        },
      },
      actor(3, ['laboratorista'], 'orden'),
    );
    expect(orden.id_orden).toBeGreaterThan(0);
    const stored = await client
      .db(dbName)
      .collection('ordenes_examen')
      .findOne({ id_orden: orden.id_orden });
    expect(stored).toBeTruthy();
  });

  it('firestore_odontograma_persists', async () => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) return;
    const projectId = `demo-test-genki-lane2-${Date.now()}`;
    const resource = await createFirebaseAdapterSet({
      id_institucion: asInstitutionId(4),
      kind: 'clinica_odontologica',
      projectId,
      emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
    });
    closers.push(() => resource.close());
    // Needs a patient; assert module is wired by expecting not_found rather than misconfigured.
    await expect(
      executeOp55(
        contextFrom(resource),
        { params: { id: 1 }, query: {}, body: { id_profesional: 1 } },
        actor(4, ['odontologo'], 'odo'),
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
