import type {
  CloseConsultaRequest,
  ConsultaCompleta,
  InstitutionKind,
  PacienteId,
} from '@genki/shared';
import { asInstitutionId } from '@genki/shared';
import { MongoClient, type Db } from 'mongodb';
import { MongoCatalogoRepository } from '../adapters/mongodb/catalogo-repository.js';
import { MongoConsultaRepository } from '../adapters/mongodb/consulta-repository.js';
import { MongoIdPort } from '../adapters/mongodb/id.js';
import { makeDocumentId, toBsonInt, type MongoStringIdDoc } from '../adapters/mongodb/mapper.js';
import { MongoPacienteRepository } from '../adapters/mongodb/paciente-repository.js';
import { assertMongoPrimaryReady, installMongoSchema } from '../adapters/mongodb/schema.js';
import { MongoUnitOfWork } from '../adapters/mongodb/unit-of-work.js';
import { closeConsulta } from '../application/close-consulta.js';
import type { PersistenceCheckpoint } from '../ports/adapter-resource.js';
import type { ClinicalContext } from '../ports/clinical-context.js';
import type { ClockPort } from '../ports/clock.js';
import type { CloseConsultaBundle } from '../ports/consulta-repository.js';
import {
  defaultKind,
  expectedInstitution99Catalog,
  expectedPrimaryCatalog,
  OTHER_INSTITUTION_ID,
  SEED_CIE10,
} from './catalog-seeds.js';
import type {
  ClinicalHarness,
  ContractClinicalContext,
  ContractConsultaRepository,
  CountSnapshot,
  FailurePoint,
} from './harness.js';

const TEST_DB = 'genki_test_mongodb_paciente';
const PRIMARY_INSTITUTION = 3;

function requireAdminUri(): string {
  const uri = process.env.MONGO_ADMIN_URI;
  if (!uri) {
    throw new Error('missing required env: MONGO_ADMIN_URI (physical Mongo required)');
  }
  return uri;
}

/** At/after fixture `fecha_hora_inicio` (2026-11-07T15:00Z) so validateConsulta accepts. */
const fixedClock: ClockPort = {
  nowIso(): string {
    return '2026-11-07T15:30:00.000Z';
  },
};

function isCloseBundle(
  input: CloseConsultaBundle | { id_paciente: PacienteId; body: CloseConsultaRequest },
): input is CloseConsultaBundle {
  return 'consulta' in input && 'diagnosticos' in input && 'tratamientos' in input;
}

function facadeConsultas(context: ClinicalContext): ContractConsultaRepository {
  return {
    closeConsulta(
      input: CloseConsultaBundle | { id_paciente: PacienteId; body: CloseConsultaRequest },
    ): Promise<ConsultaCompleta> {
      if (isCloseBundle(input)) {
        return context.consultas.closeConsulta(input);
      }
      return closeConsulta(context, input);
    },
    findById: (id) => context.consultas.findById(id),
    listByExpediente: (id) => context.consultas.listByExpediente(id),
  };
}

async function seedCatalogs(db: Db, institutionId: number): Promise<void> {
  const catalog =
    institutionId === OTHER_INSTITUTION_ID
      ? expectedInstitution99Catalog()
      : expectedPrimaryCatalog();

  for (const row of catalog.municipios) {
    await db.collection<MongoStringIdDoc>('municipios').updateOne(
      { _id: makeDocumentId(institutionId, row.id_municipio) },
      {
        $set: {
          _id: makeDocumentId(institutionId, row.id_municipio),
          institution_id: toBsonInt(institutionId),
          id_municipio: toBsonInt(row.id_municipio),
          nombre: row.nombre,
        },
      },
      { upsert: true },
    );
  }
  for (const row of catalog.profesionales) {
    await db.collection<MongoStringIdDoc>('profesionales').updateOne(
      { _id: makeDocumentId(institutionId, row.id_profesional) },
      {
        $set: {
          _id: makeDocumentId(institutionId, row.id_profesional),
          institution_id: toBsonInt(institutionId),
          id_profesional: toBsonInt(row.id_profesional),
          nombres: row.nombres,
          apellidos: row.apellidos,
          numero_colegiado: null,
          activo: true,
        },
      },
      { upsert: true },
    );
  }
  for (const row of catalog.medicamentos) {
    await db.collection<MongoStringIdDoc>('medicamentos').updateOne(
      { _id: makeDocumentId(institutionId, row.id_medicamento) },
      {
        $set: {
          _id: makeDocumentId(institutionId, row.id_medicamento),
          institution_id: toBsonInt(institutionId),
          id_medicamento: toBsonInt(row.id_medicamento),
          nombre_generico: row.nombre_generico,
          activo: true,
        },
      },
      { upsert: true },
    );
  }
  await db.collection<MongoStringIdDoc>('catalogo_cie10').updateOne(
    { _id: makeDocumentId(institutionId, SEED_CIE10) },
    {
      $set: {
        _id: makeDocumentId(institutionId, SEED_CIE10),
        institution_id: toBsonInt(institutionId),
        codigo_cie10: SEED_CIE10,
        descripcion: 'Examen general',
      },
    },
    { upsert: true },
  );
}

async function clearClinical(db: Db, institutionId: number): Promise<void> {
  const filter = { institution_id: toBsonInt(institutionId) };
  for (const name of [
    'pacientes',
    'expedientes',
    'responsables',
    'consultas',
    'counters',
  ] as const) {
    await db.collection(name).deleteMany(filter);
  }
}

async function countsFor(db: Db, institutionId: number): Promise<CountSnapshot> {
  const filter = { institution_id: toBsonInt(institutionId) };
  const [pacientes, expedientes, responsables, consultas] = await Promise.all([
    db.collection('pacientes').countDocuments(filter),
    db.collection('expedientes').countDocuments(filter),
    db.collection('responsables').countDocuments(filter),
    db.collection('consultas').countDocuments(filter),
  ]);
  let diagnosticos = 0;
  let tratamientos = 0;
  let recetas = 0;
  let detalles = 0;
  const consultaDocs = await db.collection('consultas').find(filter).toArray();
  for (const doc of consultaDocs) {
    const diags = Array.isArray(doc.diagnosticos) ? doc.diagnosticos.length : 0;
    const treats = Array.isArray(doc.tratamientos) ? doc.tratamientos.length : 0;
    const dets = Array.isArray(doc.detalles) ? doc.detalles.length : 0;
    diagnosticos += diags;
    tratamientos += treats;
    detalles += dets;
    if (doc.receta != null) {
      recetas += 1;
    }
  }
  return {
    pacientes,
    expedientes,
    responsables,
    consultas,
    diagnosticos,
    tratamientos,
    recetas,
    detalles,
  };
}

function buildContext(
  db: Db,
  institutionId: number,
  kind: InstitutionKind,
  unitOfWork: MongoUnitOfWork,
  ids: MongoIdPort,
  afterWrite: (point: PersistenceCheckpoint) => void,
): ContractClinicalContext {
  const pacientes = new MongoPacienteRepository(
    db,
    asInstitutionId(institutionId),
    kind,
    ids,
    unitOfWork,
    () => fixedClock.nowIso(),
    afterWrite,
  );
  const consultas = new MongoConsultaRepository(
    db,
    asInstitutionId(institutionId),
    ids,
    unitOfWork,
    afterWrite,
  );
  const context: ClinicalContext = {
    pacientes,
    consultas,
    catalogos: new MongoCatalogoRepository(db, institutionId),
    unitOfWork,
    clock: fixedClock,
    ids,
  };
  return {
    pacientes,
    consultas: facadeConsultas(context),
    catalogos: context.catalogos,
    unitOfWork,
    clock: fixedClock,
    ids,
  };
}

let sharedClient: MongoClient | null = null;
let sharedDb: Db | null = null;

async function sharedConnection(): Promise<{ client: MongoClient; db: Db }> {
  if (sharedClient && sharedDb) {
    return { client: sharedClient, db: sharedDb };
  }
  const client = new MongoClient(requireAdminUri());
  await client.connect();
  await assertMongoPrimaryReady(client);
  const db = client.db(TEST_DB);
  await installMongoSchema(db);
  sharedClient = client;
  sharedDb = db;
  return { client, db };
}

export async function makeMongoClinicalHarness(options?: {
  kind?: InstitutionKind;
}): Promise<ClinicalHarness> {
  const kind = options?.kind ?? defaultKind();
  const { client, db } = await sharedConnection();
  let pending: FailurePoint | null = null;
  const afterWrite = (point: PersistenceCheckpoint): void => {
    if (pending === point) {
      pending = null;
      throw new Error(`checkpoint ${point}`);
    }
  };
  const unitOfWork = new MongoUnitOfWork(client, db);
  // Shared sequence across institutions (matches memory harness) so contract
  // cases allocate distinct numeric ids and findById(foreign) cannot hit a local twin.
  const sharedIds = new MongoIdPort(db, PRIMARY_INSTITUTION);
  const context = buildContext(db, PRIMARY_INSTITUTION, kind, unitOfWork, sharedIds, afterWrite);

  await clearClinical(db, PRIMARY_INSTITUTION);
  await clearClinical(db, OTHER_INSTITUTION_ID);
  await seedCatalogs(db, PRIMARY_INSTITUTION);
  await seedCatalogs(db, OTHER_INSTITUTION_ID);

  return {
    context,
    async reset(): Promise<void> {
      pending = null;
      await clearClinical(db, PRIMARY_INSTITUTION);
      await clearClinical(db, OTHER_INSTITUTION_ID);
      await seedCatalogs(db, PRIMARY_INSTITUTION);
      await seedCatalogs(db, OTHER_INSTITUTION_ID);
    },
    failNext(point: FailurePoint): void {
      pending = point;
    },
    async counts(): Promise<CountSnapshot> {
      return countsFor(db, PRIMARY_INSTITUTION);
    },
    async otherInstitution(): Promise<ContractClinicalContext> {
      return buildContext(db, OTHER_INSTITUTION_ID, kind, unitOfWork, sharedIds, afterWrite);
    },
    async close(): Promise<void> {
      pending = null;
    },
  };
}

export async function closeMongoHarnessSharedClient(): Promise<void> {
  if (sharedClient) {
    await sharedClient
      .db(TEST_DB)
      .dropDatabase()
      .catch(() => undefined);
    await sharedClient.close();
    sharedClient = null;
    sharedDb = null;
  }
}
