import { MongoClient, type Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoIdPort } from './id.js';
import { toBsonDate, toBsonInt, type MongoStringIdDoc } from './mapper.js';
import { assertMongoPrimaryReady, installMongoSchema, MONGO_SCHEMA_COLLECTIONS } from './schema.js';
import { activeMongoSession, MongoUnitOfWork } from './unit-of-work.js';

const TEST_DB = 'genki_test_mongodb_schema';
const INSTITUTION_ID = 3;

function requireAdminUri(): string {
  const uri = process.env.MONGO_ADMIN_URI;
  if (!uri) {
    throw new Error('missing required env: MONGO_ADMIN_URI (physical Mongo required)');
  }
  return uri;
}

function samplePacienteDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: `${INSTITUTION_ID}:1`,
    institution_id: toBsonInt(INSTITUTION_ID),
    id_paciente: toBsonInt(1),
    id_institucion: toBsonInt(INSTITUTION_ID),
    tipo_documento: 'DPI',
    numero_documento: 'DEMO-3-001',
    primer_nombre: 'Paciente',
    primer_apellido: 'Ejemplo',
    fecha_nacimiento: '1990-01-01',
    sexo: 'X',
    estado: 'activo',
    segundo_nombre: null,
    segundo_apellido: null,
    tipo_sangre: null,
    telefono: null,
    correo: null,
    direccion: null,
    id_municipio: toBsonInt(1),
    fecha_registro: toBsonDate('2026-11-01T14:00:00.000Z'),
    ...overrides,
  };
}

describe('Mongo schema and replica-set transactions (E2-P4A-01)', () => {
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    client = new MongoClient(requireAdminUri());
    await client.connect();
    await assertMongoPrimaryReady(client);
    db = client.db(TEST_DB);
    await db.dropDatabase();
    await installMongoSchema(db);
  }, 60_000);

  beforeEach(async () => {
    for (const name of MONGO_SCHEMA_COLLECTIONS) {
      await db.collection(name).deleteMany({});
    }
  }, 30_000);

  afterAll(async () => {
    if (client) {
      await client
        .db(TEST_DB)
        .dropDatabase()
        .catch(() => undefined);
      await client.close();
    }
  }, 30_000);

  it('mongo_requires_primary_replica_set', async () => {
    const hello = await db.command({ hello: 1 });
    expect(hello.setName).toBe('rs0');
    expect(hello.isWritablePrimary).toBe(true);
    await expect(assertMongoPrimaryReady(client)).resolves.toBeUndefined();

    for (const name of MONGO_SCHEMA_COLLECTIONS) {
      const indexes = await db.collection(name).listIndexes().toArray();
      expect(indexes.length, `${name} must have indexes`).toBeGreaterThan(1);
    }

    const pacienteIndexes = await db.collection('pacientes').listIndexes().toArray();
    const uniqueDoc = pacienteIndexes.find(
      (idx) => idx.unique === true && idx.key?.numero_documento === 1,
    );
    expect(uniqueDoc, 'pacientes unique institution_id/numero_documento').toBeDefined();

    const responsableIndexes = await db.collection('responsables').listIndexes().toArray();
    const principalPartial = responsableIndexes.find(
      (idx) =>
        idx.unique === true &&
        idx.partialFilterExpression?.es_principal === true &&
        idx.key?.id_paciente === 1 &&
        idx.key?.es_principal === 1,
    );
    expect(principalPartial, 'responsables partial unique principal').toBeDefined();
  });

  it('mongo_validator_rejects_wrong_scalar', async () => {
    const coll = db.collection<MongoStringIdDoc>('pacientes');
    const bad = samplePacienteDoc({
      id_paciente: 'not-an-int',
    });
    await expect(coll.insertOne(bad)).rejects.toMatchObject({
      code: 121,
    });

    const good = samplePacienteDoc();
    await expect(coll.insertOne(good)).resolves.toMatchObject({ acknowledged: true });
  });

  it('mongo_ids_are_integers', async () => {
    const uow = new MongoUnitOfWork(client, db);
    const ids = new MongoIdPort(db, INSTITUTION_ID);

    const allocated = await uow.runInTransaction(async () => {
      expect(activeMongoSession()).toBeDefined();
      return ids.nextInt('paciente');
    });
    expect(allocated).toBe(1);

    const counter = await db.collection<MongoStringIdDoc>('counters').findOne({
      _id: `${INSTITUTION_ID}:paciente`,
    });
    expect(counter).not.toBeNull();
    expect(Number(counter!.next)).toBe(2);
    // Driver promoteValues maps Int32→number on read; assert wire type via $type.
    const counterTypes = await db
      .collection<MongoStringIdDoc>('counters')
      .aggregate([
        { $match: { _id: `${INSTITUTION_ID}:paciente` } },
        {
          $project: {
            nextType: { $type: '$next' },
            institutionType: { $type: '$institution_id' },
          },
        },
      ])
      .toArray();
    expect(counterTypes[0]?.nextType).toBe('int');
    expect(counterTypes[0]?.institutionType).toBe('int');

    await db.collection<MongoStringIdDoc>('pacientes').insertOne(samplePacienteDoc());
    const stored = await db.collection<MongoStringIdDoc>('pacientes').findOne({
      _id: `${INSTITUTION_ID}:1`,
    });
    expect(typeof stored!._id).toBe('string');
    expect(stored!._id).not.toMatch(/ObjectId/i);
    const pacienteTypes = await db
      .collection<MongoStringIdDoc>('pacientes')
      .aggregate([
        { $match: { _id: `${INSTITUTION_ID}:1` } },
        {
          $project: {
            idType: { $type: '$id_paciente' },
            institutionType: { $type: '$institution_id' },
          },
        },
      ])
      .toArray();
    expect(pacienteTypes[0]?.idType).toBe('int');
    expect(pacienteTypes[0]?.institutionType).toBe('int');
  });

  it('mongo_transaction_failure_aborts', async () => {
    const uow = new MongoUnitOfWork(client, db);
    const coll = db.collection<MongoStringIdDoc>('municipios');

    await expect(
      uow.runInTransaction(async () => {
        const session = activeMongoSession();
        expect(session).toBeDefined();
        await coll.insertOne(
          {
            _id: `${INSTITUTION_ID}:1`,
            institution_id: toBsonInt(INSTITUTION_ID),
            id_municipio: toBsonInt(1),
            nombre: 'Municipio de prueba',
          },
          { session: session! },
        );
        throw new Error('forced abort');
      }),
    ).rejects.toThrow(/forced abort/);

    expect(await coll.countDocuments({})).toBe(0);

    await uow.runInTransaction(async () => {
      const session = activeMongoSession();
      expect(session).toBeDefined();
      await coll.insertOne(
        {
          _id: `${INSTITUTION_ID}:1`,
          institution_id: toBsonInt(INSTITUTION_ID),
          id_municipio: toBsonInt(1),
          nombre: 'Municipio de prueba',
        },
        { session: session! },
      );
      await uow.runInTransaction(async () => {
        expect(activeMongoSession()).toBeDefined();
      });
    });
    expect(await coll.countDocuments({})).toBe(1);
  });
});
