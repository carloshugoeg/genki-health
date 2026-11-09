import { engineForKind } from '@genki/shared';
import { MongoClient } from 'mongodb';
import type { AdapterResource, ClockPort, EngineOptions } from '../../ports/index.js';
import { MongoCatalogoRepository } from './catalogo-repository.js';
import { MongoConsultaRepository } from './consulta-repository.js';
import { createMongoLane1Repositories } from './full/lane1.js';
import { createMongoLabIntakeRepository } from './full/lab-intake.js';
import { createMongoLabResultsRepository } from './full/lab-results.js';
import { MongoIdPort } from './id.js';
import { MongoPacienteRepository } from './paciente-repository.js';
import { assertMongoPrimaryReady } from './schema.js';
import { MongoUnitOfWork } from './unit-of-work.js';

class SystemClock implements ClockPort {
  nowIso(): string {
    return new Date().toISOString();
  }
}

function databaseNameFromUrl(url: string): string {
  const pathname = new URL(url).pathname.replace(/^\//, '');
  if (!pathname) {
    throw new Error('Mongo EngineOptions.url must include a database name');
  }
  return pathname;
}

/** C3.6 factory: connect, assert writable primary, return closable adapter set. */
export async function createMongoAdapterSet(options: EngineOptions): Promise<AdapterResource> {
  const client = new MongoClient(options.url);
  try {
    await client.connect();
    await assertMongoPrimaryReady(client);
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }

  const db = client.db(databaseNameFromUrl(options.url));
  const clock = options.clock ?? new SystemClock();
  const unitOfWork = new MongoUnitOfWork(client, db);
  const ids = new MongoIdPort(db, options.id_institucion);
  const afterWrite = options.afterWrite ?? (() => {});

  const pacientes = new MongoPacienteRepository(
    db,
    options.id_institucion,
    options.kind,
    ids,
    unitOfWork,
    () => clock.nowIso(),
    afterWrite,
  );
  const lane1 = createMongoLane1Repositories({
    db,
    id_institucion: options.id_institucion,
    pacientes,
    ids,
    unitOfWork,
    clock,
  });
  const labDeps = { db, id_institucion: options.id_institucion, ids, unitOfWork, clock };
  const full = {
    ...lane1,
    labIntake: createMongoLabIntakeRepository(labDeps),
    labResults: createMongoLabResultsRepository(labDeps),
  };
  const set = {
    engine: engineForKind(options.kind),
    clock,
    ids,
    unitOfWork,
    pacientes,
    consultas: new MongoConsultaRepository(db, options.id_institucion, ids, unitOfWork, afterWrite),
    catalogos: new MongoCatalogoRepository(db, options.id_institucion),
    full,
  };

  return {
    set,
    async close(): Promise<void> {
      await client.close();
    },
  };
}

export { MongoCatalogoRepository } from './catalogo-repository.js';
export { MongoConsultaRepository } from './consulta-repository.js';
export { MongoIdPort } from './id.js';
export { MongoPacienteRepository } from './paciente-repository.js';
export { MongoUnitOfWork, activeMongoSession } from './unit-of-work.js';
export {
  assertMongoPrimaryReady,
  installMongoSchema,
  MONGO_INDEXES,
  MONGO_JSON_SCHEMA,
  MONGO_SCHEMA_COLLECTIONS,
} from './schema.js';
export {
  asPlainInt,
  fromBsonDate,
  makeDocumentId,
  toBsonDate,
  toBsonInt,
  type MongoStringIdDoc,
} from './mapper.js';
