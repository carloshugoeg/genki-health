import { MongoClient, Int32 } from 'mongodb';
import { makeDocumentId, type MongoStringIdDoc } from './mapper.js';
import { assertMongoPrimaryReady } from './schema.js';

interface SeedDocument {
  collection: string;
  id: number | string;
  data: Record<string, unknown>;
  preserve?: string[];
}
const collections = new Set([
  'municipios',
  'profesionales',
  'medicamentos',
  'catalogo_cie10',
  'pacientes',
  'expedientes',
  'responsables',
]);
const counters = [
  'paciente',
  'expediente',
  'responsable',
  'consulta',
  'diagnostico',
  'tratamiento',
  'receta',
  'receta_folio',
];
function bson(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === 'number'
        ? new Int32(value)
        : key.startsWith('fecha_') && typeof value === 'string' && value.includes('T')
          ? new Date(value)
          : value,
    ]),
  );
}
function comparable(value: unknown): string {
  return JSON.stringify(
    value instanceof Date ? value.toISOString() : value instanceof Int32 ? value.valueOf() : value,
  );
}

/** Bootstrap remains owner-only; validators and unique natural keys are never bypassed. */
export async function seedMongo(url: string, rows: SeedDocument[]): Promise<void> {
  const target = new URL(url);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !/^\/genki_test_[a-z0-9_]+$/.test(target.pathname)
  )
    throw new Error('Mongo seed requires a loopback disposable genki_test_ database');
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000, directConnection: true });
  await client.connect();
  const session = client.startSession();
  try {
    await assertMongoPrimaryReady(client);
    const db = client.db(target.pathname.slice(1));
    await session.withTransaction(async () => {
      for (const { collection, id, data, preserve = [] } of rows) {
        if (!collections.has(collection)) throw new Error('Invalid seed collection');
        const coll = db.collection<MongoStringIdDoc>(collection);
        const _id = makeDocumentId(3, id);
        const expected = { ...bson(data), _id, institution_id: new Int32(3) };
        const current = await coll.findOne({ _id }, { session });
        if (current) {
          for (const [key, value] of Object.entries(expected)) {
            if (!preserve.includes(key) && comparable(current[key]) !== comparable(value))
              throw new Error(`Seed fixture conflict in ${collection}`);
          }
        } else {
          await coll.insertOne(expected, { session });
        }
      }
      // Conservative floor across ALL persisted clinical IDs, including embedded bundles.
      let maximum = 103;
      const inspect = (value: unknown): void => {
        if (Array.isArray(value)) {
          value.forEach(inspect);
          return;
        }
        if (!value || typeof value !== 'object' || value instanceof Date) return;
        for (const [key, item] of Object.entries(value)) {
          if (key.startsWith('id_') && typeof item === 'number') maximum = Math.max(maximum, item);
          if (key === 'folio' && typeof item === 'string' && /^REC-\d+$/.test(item))
            maximum = Math.max(maximum, Number(item.slice(4)));
          inspect(item);
        }
      };
      for (const name of ['pacientes', 'expedientes', 'responsables', 'consultas']) {
        for await (const doc of db.collection(name).find({ institution_id: 3 }, { session }))
          inspect(doc);
      }
      if (!Number.isSafeInteger(maximum) || maximum >= 2147483647)
        throw new Error('Seed counter exhausted');
      for (const name of counters) {
        await db.collection<MongoStringIdDoc>('counters').updateOne(
          { _id: makeDocumentId(3, name) },
          {
            $setOnInsert: { institution_id: new Int32(3), name },
            $max: { next: new Int32(maximum + 1) },
          },
          { upsert: true, session },
        );
      }
    });
  } finally {
    await session.endSession();
    await client.close();
  }
}
