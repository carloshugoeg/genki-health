import { MongoClient, type Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { toBsonDate, toBsonInt, type MongoStringIdDoc } from '../../src/adapters/mongodb/mapper.js';
import { assertMongoPrimaryReady, installMongoSchema } from '../../src/adapters/mongodb/schema.js';
import {
  installMongoSecurity,
  MONGO_APP_USER,
  MONGO_REPORT_USER,
  MONGO_REPORT_VIEW,
  mongoAuthenticatedUri,
} from '../../src/adapters/mongodb/security.js';
import { MongoUnitOfWork } from '../../src/adapters/mongodb/unit-of-work.js';

const TEST_DB = 'genki_test_mongodb_security';
const INSTITUTION_ID = 3;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env: ${name} (physical Mongo required)`);
  }
  return value;
}

function requireAdminUri(): string {
  return requireEnv('MONGO_ADMIN_URI');
}

function isUnauthorized(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: number }).code;
  if (code === 13) {
    return true;
  }
  const message = String((error as { message?: string }).message ?? error);
  return /not authorized|unauthorized/i.test(message);
}

function samplePaciente(id: number, estado: string): MongoStringIdDoc & Record<string, unknown> {
  return {
    _id: `${INSTITUTION_ID}:${id}`,
    institution_id: toBsonInt(INSTITUTION_ID),
    id_paciente: toBsonInt(id),
    id_institucion: toBsonInt(INSTITUTION_ID),
    tipo_documento: 'DPI',
    numero_documento: `SEC-${id}`,
    primer_nombre: 'Paciente',
    primer_apellido: 'Seguridad',
    fecha_nacimiento: '1990-01-01',
    sexo: 'X',
    estado,
    segundo_nombre: null,
    segundo_apellido: null,
    tipo_sangre: null,
    telefono: null,
    correo: null,
    direccion: null,
    id_municipio: toBsonInt(1),
    fecha_registro: toBsonDate('2026-11-01T14:00:00.000Z'),
  };
}

describe('Mongo app/report permissions (E2-P4A-04)', () => {
  let admin: MongoClient;
  let db: Db;
  let appUri: string;
  let reportUri: string;

  beforeAll(async () => {
    const appPassword = requireEnv('MONGO_APP_PASSWORD');
    const reportPassword = requireEnv('MONGO_REPORT_PASSWORD');
    admin = new MongoClient(requireAdminUri());
    await admin.connect();
    await assertMongoPrimaryReady(admin);
    db = admin.db(TEST_DB);
    await db.dropDatabase();
    await installMongoSchema(db);
    await installMongoSecurity(db, { appPassword, reportPassword });
    appUri = mongoAuthenticatedUri({
      adminUri: requireAdminUri(),
      database: TEST_DB,
      user: MONGO_APP_USER,
      password: appPassword,
    });
    reportUri = mongoAuthenticatedUri({
      adminUri: requireAdminUri(),
      database: TEST_DB,
      user: MONGO_REPORT_USER,
      password: reportPassword,
    });
  }, 60_000);

  beforeEach(async () => {
    await db.collection('pacientes').deleteMany({});
    await db.collection('expedientes').deleteMany({});
    await db.collection('responsables').deleteMany({});
    await db.collection('consultas').deleteMany({});
    await db.collection('counters').deleteMany({});
  }, 30_000);

  afterAll(async () => {
    if (admin) {
      await admin
        .db(TEST_DB)
        .dropDatabase()
        .catch(() => undefined);
      await admin.close();
    }
  }, 30_000);

  it('mongo_app_cannot_remove_drop_or_bypass_validator', async () => {
    await db.collection('pacientes').insertOne(samplePaciente(1, 'activo'));

    const app = new MongoClient(appUri);
    await app.connect();
    try {
      const appDb = app.db(TEST_DB);
      await expect(
        appDb.collection('pacientes').deleteOne({ _id: `${INSTITUTION_ID}:1` }),
      ).rejects.toSatisfy(isUnauthorized);
      await expect(appDb.collection('pacientes').drop()).rejects.toSatisfy(isUnauthorized);
      await expect(
        appDb
          .collection('pacientes')
          .insertOne(
            { _id: `${INSTITUTION_ID}:bad`, institution_id: 'not-an-int' },
            { bypassDocumentValidation: true },
          ),
      ).rejects.toSatisfy((error: unknown) => {
        if (isUnauthorized(error)) {
          return true;
        }
        const code =
          error && typeof error === 'object' ? (error as { code?: number }).code : undefined;
        return code === 121;
      });
    } finally {
      await app.close();
    }
  });

  it('mongo_reporter_cannot_read_patient', async () => {
    await db.collection('pacientes').insertOne(samplePaciente(2, 'activo'));

    const reporter = new MongoClient(reportUri);
    await reporter.connect();
    try {
      const reportDb = reporter.db(TEST_DB);
      await expect(reportDb.collection('pacientes').find({}).toArray()).rejects.toSatisfy(
        isUnauthorized,
      );
    } finally {
      await reporter.close();
    }
  });

  it('mongo_reporter_can_read_aggregate_view', async () => {
    await db
      .collection('pacientes')
      .insertMany([
        samplePaciente(10, 'activo'),
        samplePaciente(11, 'activo'),
        samplePaciente(12, 'inactivo'),
      ]);

    const reporter = new MongoClient(reportUri);
    await reporter.connect();
    try {
      const reportDb = reporter.db(TEST_DB);
      const rows = await reportDb.collection(MONGO_REPORT_VIEW).find({}).toArray();
      expect(rows.length).toBeGreaterThanOrEqual(2);
      for (const row of rows) {
        const keys = Object.keys(row)
          .filter((key) => key !== '_id')
          .sort();
        expect(keys).toEqual(['cantidad', 'estado', 'institution_id']);
        expect(row).not.toHaveProperty('numero_documento');
        expect(row).not.toHaveProperty('primer_nombre');
        expect(row).not.toHaveProperty('correo');
      }
      const activo = rows.find((row) => row.estado === 'activo');
      const inactivo = rows.find((row) => row.estado === 'inactivo');
      expect(activo?.cantidad).toBe(2);
      expect(inactivo?.cantidad).toBe(1);
    } finally {
      await reporter.close();
    }
  });

  it('mongo_runtime_transaction_uses_app_role', async () => {
    const app = new MongoClient(appUri);
    await app.connect();
    try {
      const status = await app.db(TEST_DB).command({ connectionStatus: 1 });
      const authUsers = (status.authInfo?.authenticatedUsers ?? []) as Array<{ user: string }>;
      expect(authUsers.some((entry) => entry.user === MONGO_APP_USER)).toBe(true);
      expect(authUsers.some((entry) => entry.user === 'root')).toBe(false);

      const appDb = app.db(TEST_DB);
      const uow = new MongoUnitOfWork(app, appDb);
      await uow.runInTransaction(async () => {
        await appDb.collection('pacientes').insertOne(samplePaciente(20, 'activo'));
      });
      const found = await appDb.collection('pacientes').findOne({ _id: `${INSTITUTION_ID}:20` });
      expect(found?.numero_documento).toBe('SEC-20');
    } finally {
      await app.close();
    }
  });
});
