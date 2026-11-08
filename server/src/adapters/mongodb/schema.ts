import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CreateIndexesOptions, Db, IndexDescription, MongoClient } from 'mongodb';

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), 'schema.json');

export const MONGO_JSON_SCHEMA = JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<
  string,
  { $jsonSchema: Record<string, unknown> }
>;

export const MONGO_SCHEMA_COLLECTIONS = Object.keys(MONGO_JSON_SCHEMA);

interface IndexSpec {
  keys: IndexDescription['key'];
  options?: CreateIndexesOptions;
}

/** Compound / partial unique indexes from C5.1. */
export const MONGO_INDEXES: Record<string, IndexSpec[]> = {
  pacientes: [
    { keys: { institution_id: 1, id_paciente: 1 }, options: { unique: true, name: 'uq_inst_id_paciente' } },
    {
      keys: { institution_id: 1, numero_documento: 1 },
      options: { unique: true, name: 'uq_inst_numero_documento' },
    },
  ],
  expedientes: [
    {
      keys: { institution_id: 1, id_expediente: 1 },
      options: { unique: true, name: 'uq_inst_id_expediente' },
    },
    {
      keys: { institution_id: 1, id_paciente: 1 },
      options: { unique: true, name: 'uq_inst_expediente_paciente' },
    },
    {
      keys: { institution_id: 1, numero_expediente: 1 },
      options: { unique: true, name: 'uq_inst_numero_expediente' },
    },
    {
      keys: { institution_id: 1, estado: 1, id_paciente: 1 },
      options: { name: 'ix_inst_estado_paciente' },
    },
  ],
  responsables: [
    { keys: { institution_id: 1, id_paciente: 1 }, options: { name: 'ix_inst_responsable_paciente' } },
    {
      keys: { institution_id: 1, id_paciente: 1 },
      options: {
        unique: true,
        name: 'uq_inst_paciente_principal',
        partialFilterExpression: { es_principal: true },
      },
    },
  ],
  consultas: [
    { keys: { institution_id: 1, id_consulta: 1 }, options: { unique: true, name: 'uq_inst_id_consulta' } },
    {
      keys: { institution_id: 1, id_expediente: 1, fecha_hora_inicio: -1, id_consulta: -1 },
      options: { name: 'ix_inst_expediente_inicio_consulta' },
    },
  ],
  municipios: [
    {
      keys: { institution_id: 1, id_municipio: 1 },
      options: { unique: true, name: 'uq_inst_id_municipio' },
    },
  ],
  profesionales: [
    {
      keys: { institution_id: 1, id_profesional: 1 },
      options: { unique: true, name: 'uq_inst_id_profesional' },
    },
    {
      keys: { institution_id: 1, numero_colegiado: 1 },
      options: {
        unique: true,
        name: 'uq_inst_colegiado_string',
        partialFilterExpression: { numero_colegiado: { $type: 'string' } },
      },
    },
  ],
  medicamentos: [
    {
      keys: { institution_id: 1, id_medicamento: 1 },
      options: { unique: true, name: 'uq_inst_id_medicamento' },
    },
  ],
  catalogo_cie10: [
    {
      keys: { institution_id: 1, codigo_cie10: 1 },
      options: { unique: true, name: 'uq_inst_codigo_cie10' },
    },
  ],
  counters: [
    {
      keys: { institution_id: 1, name: 1 },
      options: { unique: true, name: 'uq_inst_counter_name' },
    },
  ],
};

export async function assertMongoPrimaryReady(client: MongoClient): Promise<void> {
  const hello = await client.db('admin').command({ hello: 1 });
  if (hello.setName !== 'rs0') {
    throw new Error(`mongo replica set required: expected rs0, got ${String(hello.setName)}`);
  }
  if (hello.isWritablePrimary !== true) {
    throw new Error('mongo primary required: node is not writable primary');
  }
}

async function ensureCollection(db: Db, name: string, jsonSchema: Record<string, unknown>): Promise<void> {
  const existing = await db.listCollections({ name }, { nameOnly: true }).toArray();
  const validator = {
    $jsonSchema: jsonSchema.$jsonSchema ?? jsonSchema,
  };
  if (existing.length === 0) {
    await db.createCollection(name, {
      validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
    return;
  }
  await db.command({
    collMod: name,
    validator,
    validationLevel: 'strict',
    validationAction: 'error',
  });
}

async function ensureIndexes(db: Db, name: string, specs: IndexSpec[]): Promise<void> {
  if (specs.length === 0) {
    return;
  }
  const coll = db.collection(name);
  for (const spec of specs) {
    await coll.createIndex(spec.keys, spec.options);
  }
}

/** Idempotent owner-bootstrap: validators + indexes for every C5.1 collection. */
export async function installMongoSchema(db: Db): Promise<void> {
  for (const name of MONGO_SCHEMA_COLLECTIONS) {
    const entry = MONGO_JSON_SCHEMA[name];
    await ensureCollection(db, name, entry);
    await ensureIndexes(db, name, MONGO_INDEXES[name] ?? []);
  }
}

/**
 * Bootstrap hook for Laboratorio (called by owner scripts once wired).
 * Asserts rs0 primary, then installs schema idempotently.
 */
export async function bootstrapMongoDatabase(
  client: MongoClient,
  databaseName = 'genki_laboratorio',
): Promise<void> {
  await assertMongoPrimaryReady(client);
  await installMongoSchema(client.db(databaseName));
}
