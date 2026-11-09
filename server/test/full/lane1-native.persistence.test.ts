/**
 * One native write/reread proof per engine for lane-1 clinical shared.
 * Requires disposable engines (compose + Firestore emulator) and admin URLs.
 */
import { randomUUID } from 'node:crypto';
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
import { makeDocumentId, toBsonInt } from '../../src/adapters/mongodb/mapper.js';
import { executeOp12, executeOp16 } from '../../src/application/full/record.js';
import { executeOp26, executeOp27 } from '../../src/application/full/consultation.js';
import { fullModulesFromSet, type AdapterSetWithFull } from '../../src/config/full-modules.js';
import type { FullContext, OperationContext } from '../../src/ports/full/context.js';
import type { AdapterResource } from '../../src/ports/adapter-resource.js';
import { SEED_MUNICIPIO_ID, SEED_PROFESIONAL_ID } from '../../src/testing/catalog-seeds.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const engined = Boolean(
  process.env.PG_ADMIN_URL && process.env.MYSQL_ADMIN_URL && process.env.MONGO_ADMIN_URI,
);

function actor(institutionId: number, suffix: string): OperationContext {
  return {
    id_institucion: asInstitutionId(institutionId),
    id_usuario: 10,
    id_profesional: SEED_PROFESIONAL_ID,
    roles: ['medico', 'enfermeria'],
    permissions: [],
    now: '2026-11-09T15:00:00.000Z',
    idempotency_key: `lane1-${institutionId}-${suffix}`,
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

describe.skipIf(!engined)('lane-1 native persistence', () => {
  const closers: Array<() => Promise<void>> = [];

  afterAll(async () => {
    for (const close of closers.reverse()) {
      await close().catch(() => undefined);
    }
  });

  it('postgres_allergy_and_vitals_persist', async () => {
    const adminUrl = process.env.PG_ADMIN_URL!;
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    const db = 'genki_test_lane1_pg';
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
    await client.query(
      `INSERT INTO institucion (id_institucion, nombre, tipo, nit, direccion, telefono, correo, motor_datos)
       VALUES (1, 'Hospital', 'hospital', 'N1', 'a', '1', 'h@x.invalid', 'postgres')`,
    );
    await client.query(`INSERT INTO municipio (id_municipio, nombre) VALUES ($1, 'Muni')`, [
      SEED_MUNICIPIO_ID,
    ]);
    await client.query(
      `INSERT INTO profesional (id_profesional, id_institucion, nombres, apellidos, activo)
       VALUES ($1, 1, 'Doc', 'Uno', true)`,
      [SEED_PROFESIONAL_ID],
    );
    await client.end();
    closers.push(async () => {
      await admin.query(`DROP DATABASE IF EXISTS ${db}`).catch(() => undefined);
      await admin.end().catch(() => undefined);
    });

    const app = await createPostgresAdapterSet({
      id_institucion: asInstitutionId(1),
      kind: 'hospital_general',
      url: appUrl,
    });
    closers.push(() => app.close());

    const ctx = contextFrom(app);
    const created = await app.set.pacientes.createWithExpediente({
      tipo_documento: 'DPI',
      numero_documento: 'LANE1-PG-1',
      primer_nombre: 'Ana',
      primer_apellido: 'Perez',
      fecha_nacimiento: '1991-02-02',
      sexo: 'F',
      id_municipio: SEED_MUNICIPIO_ID,
    });
    const allergy = await executeOp16(
      ctx,
      {
        params: { id: created.paciente.id_paciente },
        query: {},
        body: { sustancia: 'Penicilina', tipo: 'medicamento', severidad: 'moderada' },
      },
      actor(1, 'pg-al'),
    );
    const ficha = await executeOp12(
      ctx,
      { params: { id: created.paciente.id_paciente }, query: {}, body: {} },
      actor(1, 'pg-ficha'),
    );
    expect(ficha.alergias.some((row) => row.id_alergia === allergy.id_alergia)).toBe(true);

    const draft = await executeOp26(
      ctx,
      {
        params: { id: created.paciente.id_paciente },
        query: {},
        body: {
          id_profesional: SEED_PROFESIONAL_ID,
          tipo: 'seguimiento',
          motivo_consulta: 'Control',
          fecha_hora_inicio: '2026-11-09T15:00:00.000Z',
        },
      },
      actor(1, 'pg-op26'),
    );
    const signos = await executeOp27(
      ctx,
      {
        params: { id: draft.consulta.id_consulta },
        query: {},
        body: { temperatura_c: 37.1, frecuencia_cardiaca: 80 },
      },
      { ...actor(1, 'pg-op27'), roles: ['enfermeria'] },
    );
    expect(signos.temperatura_c).toBe(37.1);
  }, 120_000);

  it('mysql_allergy_persists', async () => {
    const adminUrl = process.env.MYSQL_ADMIN_URL!;
    const db = 'genki_test_lane1_mysql';
    const admin = await mysql.createConnection({ uri: adminUrl, multipleStatements: true });
    await admin.query(`DROP DATABASE IF EXISTS \`${db}\``);
    await admin.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci`);
    await admin.end();

    const appUrl = rebuildSqlUrl(adminUrl, db, 'mysql');
    const migrator = await mysql.createConnection({ uri: appUrl, multipleStatements: true });
    await applySqlMigrations('mysql', async (sql) => {
      await migrator.query(sql);
    });
    await migrator.query(
      `INSERT INTO institucion (id_institucion, nombre, tipo, nit, direccion, telefono, correo, motor_datos)
       VALUES (2, 'Pediatria', 'centro_pediatrico', 'N2', 'a', '1', 'p@x.invalid', 'mysql')`,
    );
    await migrator.query(`INSERT INTO municipio (id_municipio, nombre) VALUES (?, 'Muni')`, [
      SEED_MUNICIPIO_ID,
    ]);
    await migrator.query(
      `INSERT INTO profesional (id_profesional, id_institucion, nombres, apellidos, activo)
       VALUES (?, 2, 'Doc', 'Dos', true)`,
      [SEED_PROFESIONAL_ID],
    );
    await migrator.end();

    const app = await createMysqlAdapterSet({
      id_institucion: asInstitutionId(2),
      kind: 'centro_pediatrico',
      url: appUrl,
    });
    closers.push(() => app.close());

    const ctx = contextFrom(app);
    const created = await app.set.pacientes.createWithExpediente({
      tipo_documento: 'DPI',
      numero_documento: 'LANE1-MY-1',
      primer_nombre: 'Luis',
      primer_apellido: 'Diaz',
      fecha_nacimiento: '2015-03-03',
      sexo: 'M',
      id_municipio: SEED_MUNICIPIO_ID,
      responsables: [
        {
          tipo_documento: 'DPI',
          numero_documento: 'TUT-LANE1',
          nombre_completo: 'Madre Diaz',
          parentesco: 'madre',
          telefono: '5555-1111',
          es_principal: true,
        },
      ],
    });
    const allergy = await executeOp16(
      ctx,
      {
        params: { id: created.paciente.id_paciente },
        query: {},
        body: { sustancia: 'Latex', tipo: 'ambiental', severidad: 'leve' },
      },
      actor(2, 'my-al'),
    );
    const ficha = await executeOp12(
      ctx,
      { params: { id: created.paciente.id_paciente }, query: {}, body: {} },
      actor(2, 'my-ficha'),
    );
    expect(ficha.alergias.some((row) => row.id_alergia === allergy.id_alergia)).toBe(true);
  }, 120_000);

  it('mongodb_allergy_persists', async () => {
    const adminUri = process.env.MONGO_ADMIN_URI!;
    const client = new MongoClient(adminUri);
    await client.connect();
    const dbName = 'genki_test_lane1_mongo';
    const institutionId = 3;
    await client
      .db(dbName)
      .dropDatabase()
      .catch(() => undefined);
    await installMongoSchema(client.db(dbName));
    const db = client.db(dbName);
    await db.collection('municipios').updateOne(
      { _id: makeDocumentId(institutionId, SEED_MUNICIPIO_ID) },
      {
        $set: {
          _id: makeDocumentId(institutionId, SEED_MUNICIPIO_ID),
          institution_id: toBsonInt(institutionId),
          id_municipio: toBsonInt(SEED_MUNICIPIO_ID),
          nombre: 'Muni',
        },
      },
      { upsert: true },
    );
    await db.collection('profesionales').updateOne(
      { _id: makeDocumentId(institutionId, SEED_PROFESIONAL_ID) },
      {
        $set: {
          _id: makeDocumentId(institutionId, SEED_PROFESIONAL_ID),
          institution_id: toBsonInt(institutionId),
          id_profesional: toBsonInt(SEED_PROFESIONAL_ID),
          nombres: 'Doc',
          apellidos: 'Tres',
          numero_colegiado: null,
          activo: true,
        },
      },
      { upsert: true },
    );

    const resource = await createMongoAdapterSet({
      id_institucion: asInstitutionId(institutionId),
      kind: 'laboratorio_clinico',
      url: `${adminUri.split('?')[0]!.replace(/\/admin$/, `/${dbName}`)}?replicaSet=rs0&directConnection=true&authSource=admin`,
    });
    closers.push(() => resource.close());
    closers.push(async () => {
      await client
        .db(dbName)
        .dropDatabase()
        .catch(() => undefined);
      await client.close().catch(() => undefined);
    });

    const ctx = contextFrom(resource);
    const created = await resource.set.pacientes.createWithExpediente({
      tipo_documento: 'DPI',
      numero_documento: 'LANE1-MO-1',
      primer_nombre: 'Mia',
      primer_apellido: 'Sol',
      fecha_nacimiento: '1992-04-04',
      sexo: 'F',
      id_municipio: SEED_MUNICIPIO_ID,
    });
    const allergy = await executeOp16(
      ctx,
      {
        params: { id: created.paciente.id_paciente },
        query: {},
        body: { sustancia: 'Ibuprofeno', tipo: 'medicamento', severidad: 'severa' },
      },
      actor(institutionId, 'mo-al'),
    );
    const ficha = await executeOp12(
      ctx,
      { params: { id: created.paciente.id_paciente }, query: {}, body: {} },
      actor(institutionId, 'mo-ficha'),
    );
    expect(ficha.alergias.some((row) => row.id_alergia === allergy.id_alergia)).toBe(true);
  }, 120_000);

  it('firestore_allergy_persists', async () => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error('FIRESTORE_EMULATOR_HOST required for firestore native proof');
    }
    process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? 'demo-genki-health';
    process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'demo-genki-health';
    const projectId = `demo-test-genki-lane1-${randomUUID().slice(0, 8)}`;
    const resource = await createFirebaseAdapterSet({
      id_institucion: asInstitutionId(4),
      kind: 'clinica_odontologica',
      projectId,
      emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
    });
    closers.push(() => resource.close());

    await resource.set.unitOfWork.runInTransaction(async () => {
      await resource.set.unitOfWork.create('municipios', SEED_MUNICIPIO_ID, {
        id_municipio: SEED_MUNICIPIO_ID,
        nombre: 'Muni',
      });
      await resource.set.unitOfWork.create('professionals', SEED_PROFESIONAL_ID, {
        id_profesional: SEED_PROFESIONAL_ID,
        nombres: 'Doc',
        apellidos: 'Cuatro',
        activo: true,
        id_institucion: 4,
      });
    });

    const ctx = contextFrom(resource);
    const created = await resource.set.pacientes.createWithExpediente({
      tipo_documento: 'DPI',
      numero_documento: 'LANE1-FS-1',
      primer_nombre: 'Eva',
      primer_apellido: 'Ruiz',
      fecha_nacimiento: '1988-05-05',
      sexo: 'F',
      id_municipio: SEED_MUNICIPIO_ID,
    });
    const allergy = await executeOp16(
      ctx,
      {
        params: { id: created.paciente.id_paciente },
        query: {},
        body: { sustancia: 'Anestesia', tipo: 'medicamento', severidad: 'leve' },
      },
      actor(4, 'fs-al'),
    );
    const ficha = await executeOp12(
      ctx,
      { params: { id: created.paciente.id_paciente }, query: {}, body: {} },
      actor(4, 'fs-ficha'),
    );
    expect(ficha.alergias.some((row) => row.id_alergia === allergy.id_alergia)).toBe(true);
  }, 120_000);
});
