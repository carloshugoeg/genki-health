import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InstitutionKind } from '@genki/shared';
import { asInstitutionId } from '@genki/shared';
import pg from 'pg';
import { PostgresCatalogoRepository } from '../adapters/postgres/catalogo-repository.js';
import { PostgresIdPort } from '../adapters/postgres/id.js';
import { PostgresPacienteRepository } from '../adapters/postgres/paciente-repository.js';
import { PostgresUnitOfWork } from '../adapters/postgres/unit-of-work.js';
import type { PersistenceCheckpoint } from '../ports/adapter-resource.js';
import type { ClockPort } from '../ports/clock.js';
import {
  OTHER_INSTITUTION_ID,
  SEED_CIE10,
  SEED_MEDICAMENTO_1,
  SEED_MEDICAMENTO_2,
  SEED_MUNICIPIO_ID,
  SEED_PROFESIONAL_99_ID,
  SEED_PROFESIONAL_ID,
  defaultKind,
} from './catalog-seeds.js';
import type {
  ClinicalHarness,
  ContractClinicalContext,
  ContractConsultaRepository,
  CountSnapshot,
  FailurePoint,
} from './harness.js';

const TEST_DB = 'genki_test_postgres_paciente';
const PRIMARY_INSTITUTION_ID = 1;
const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../adapters/postgres/migrations',
);

interface SharedPostgres {
  admin: pg.Client;
  pool: pg.Pool;
  dbUrl: string;
}

let shared: SharedPostgres | undefined;

function requireAdminUrl(): string {
  const url = process.env.PG_ADMIN_URL;
  if (!url) {
    throw new Error('missing required env: PG_ADMIN_URL (physical Postgres required)');
  }
  return url;
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

async function applyMigrations(client: pg.Client): Promise<void> {
  for (const file of migrationFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    await client.query(sql);
  }
}

async function recreateTestDatabase(admin: pg.Client): Promise<void> {
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [
    TEST_DB,
  ]);
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
}

async function ensureShared(): Promise<SharedPostgres> {
  if (shared) {
    return shared;
  }

  const admin = new pg.Client({ connectionString: requireAdminUrl() });
  await admin.connect();
  await recreateTestDatabase(admin);

  const adminUrl = new URL(requireAdminUrl());
  adminUrl.pathname = `/${TEST_DB}`;
  const dbUrl = adminUrl.toString();

  const migrator = new pg.Client({ connectionString: dbUrl });
  await migrator.connect();
  await applyMigrations(migrator);
  await migrator.end();

  const pool = new pg.Pool({ connectionString: dbUrl, max: 5 });
  shared = { admin, pool, dbUrl };
  return shared;
}

async function seedCatalog(client: pg.Pool | pg.PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO institucion (id_institucion, nombre, tipo, nit, direccion, telefono, correo, motor_datos)
     VALUES
       ($1, 'Hospital Demo', 'hospital', 'NIT-1', 'Calle 1', '000', 'h@example.invalid', 'postgres'),
       ($2, 'Other Demo', 'hospital', 'NIT-99', 'Calle 99', '000', 'o@example.invalid', 'postgres')
     ON CONFLICT (id_institucion) DO NOTHING`,
    [PRIMARY_INSTITUTION_ID, OTHER_INSTITUTION_ID],
  );
  await client.query(
    `INSERT INTO municipio (id_municipio, nombre) VALUES ($1, 'Municipio de prueba')
     ON CONFLICT (id_municipio) DO NOTHING`,
    [SEED_MUNICIPIO_ID],
  );
  await client.query(
    `INSERT INTO profesional (id_profesional, id_institucion, nombres, apellidos, activo)
     VALUES
       ($1, $2, 'Profesional Simulado', 'Uno', true),
       ($3, $4, 'Profesional Simulado', 'Institucion99', true)
     ON CONFLICT (id_profesional) DO NOTHING`,
    [SEED_PROFESIONAL_ID, PRIMARY_INSTITUTION_ID, SEED_PROFESIONAL_99_ID, OTHER_INSTITUTION_ID],
  );
  await client.query(
    `INSERT INTO medicamento (
       id_medicamento, nombre_generico, principio_activo, concentracion,
       forma_farmaceutica, presentacion, requiere_receta, activo
     ) VALUES
       ($1, 'Medicamento didáctico A', 'a', '1mg', 'tab', 'caja', true, true),
       ($2, 'Medicamento didáctico B', 'b', '1mg', 'tab', 'caja', true, true)
     ON CONFLICT (id_medicamento) DO NOTHING`,
    [SEED_MEDICAMENTO_1, SEED_MEDICAMENTO_2],
  );
  await client.query(
    `INSERT INTO catalogo_cie10 (codigo_cie10, descripcion)
     VALUES ($1, 'Examen general')
     ON CONFLICT (codigo_cie10) DO NOTHING`,
    [SEED_CIE10],
  );
  await client.query(
    `INSERT INTO id_counter (nombre, siguiente) VALUES ('receta_folio', 1)
     ON CONFLICT (nombre) DO UPDATE SET siguiente = EXCLUDED.siguiente`,
  );
}

async function clearClinical(client: pg.Pool): Promise<void> {
  await client.query(
    `TRUNCATE detalle_receta, receta, tratamiento, diagnostico, consulta,
              responsable, expediente, paciente, id_counter RESTART IDENTITY CASCADE`,
  );
}

async function countsFor(client: pg.Pool, institutionId: number): Promise<CountSnapshot> {
  const [
    pacientes,
    expedientes,
    responsables,
    consultas,
    diagnosticos,
    tratamientos,
    recetas,
    detalles,
  ] = await Promise.all([
    client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM paciente WHERE id_institucion = $1`,
      [institutionId],
    ),
    client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
           FROM expediente e
           JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE p.id_institucion = $1`,
      [institutionId],
    ),
    client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
           FROM responsable r
           JOIN paciente p ON p.id_paciente = r.id_paciente
          WHERE p.id_institucion = $1`,
      [institutionId],
    ),
    client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
           FROM consulta c
           JOIN expediente e ON e.id_expediente = c.id_expediente
           JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE p.id_institucion = $1`,
      [institutionId],
    ),
    client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
           FROM diagnostico d
           JOIN consulta c ON c.id_consulta = d.id_consulta
           JOIN expediente e ON e.id_expediente = c.id_expediente
           JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE p.id_institucion = $1`,
      [institutionId],
    ),
    client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
           FROM tratamiento t
           JOIN diagnostico d ON d.id_diagnostico = t.id_diagnostico
           JOIN consulta c ON c.id_consulta = d.id_consulta
           JOIN expediente e ON e.id_expediente = c.id_expediente
           JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE p.id_institucion = $1`,
      [institutionId],
    ),
    client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
           FROM receta r
           JOIN consulta c ON c.id_consulta = r.id_consulta
           JOIN expediente e ON e.id_expediente = c.id_expediente
           JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE p.id_institucion = $1`,
      [institutionId],
    ),
    client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
           FROM detalle_receta dr
           JOIN receta r ON r.id_receta = dr.id_receta
           JOIN consulta c ON c.id_consulta = r.id_consulta
           JOIN expediente e ON e.id_expediente = c.id_expediente
           JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE p.id_institucion = $1`,
      [institutionId],
    ),
  ]);

  return {
    pacientes: pacientes.rows[0]!.n,
    expedientes: expedientes.rows[0]!.n,
    responsables: responsables.rows[0]!.n,
    consultas: consultas.rows[0]!.n,
    diagnosticos: diagnosticos.rows[0]!.n,
    tratamientos: tratamientos.rows[0]!.n,
    recetas: recetas.rows[0]!.n,
    detalles: detalles.rows[0]!.n,
  };
}

function stubConsultas(): ContractConsultaRepository {
  const unavailable = (): never => {
    throw new Error('postgres consulta repository is out of scope for E2-P3A-03');
  };
  return {
    closeConsulta: unavailable,
    findById: unavailable,
    listByExpediente: unavailable,
  };
}

function buildContext(
  pool: pg.Pool,
  institutionId: number,
  kind: InstitutionKind,
  afterWrite: (point: PersistenceCheckpoint) => void,
  clock: ClockPort,
): ContractClinicalContext {
  const unitOfWork = new PostgresUnitOfWork(pool);
  const pacientes = new PostgresPacienteRepository(
    asInstitutionId(institutionId),
    kind,
    unitOfWork,
    () => clock.nowIso(),
    afterWrite,
  );
  return {
    pacientes,
    consultas: stubConsultas(),
    catalogos: new PostgresCatalogoRepository(institutionId),
    unitOfWork,
    clock,
    ids: new PostgresIdPort(),
  };
}

export async function makePostgresClinicalHarness(options?: {
  kind?: InstitutionKind;
}): Promise<ClinicalHarness> {
  const kind = options?.kind ?? defaultKind();
  const { pool } = await ensureShared();
  let pending: FailurePoint | null = null;
  const afterWrite = (point: PersistenceCheckpoint): void => {
    if (pending === point) {
      pending = null;
      throw new Error(`checkpoint ${point}`);
    }
  };
  const clock: ClockPort = {
    nowIso(): string {
      return new Date().toISOString();
    },
  };

  await seedCatalog(pool);

  return {
    context: buildContext(pool, PRIMARY_INSTITUTION_ID, kind, afterWrite, clock),
    async reset(): Promise<void> {
      await clearClinical(pool);
      await seedCatalog(pool);
      pending = null;
    },
    failNext(point: FailurePoint): void {
      pending = point;
    },
    async counts(): Promise<CountSnapshot> {
      return countsFor(pool, PRIMARY_INSTITUTION_ID);
    },
    async otherInstitution(): Promise<ContractClinicalContext> {
      return buildContext(pool, OTHER_INSTITUTION_ID, kind, afterWrite, clock);
    },
    async close(): Promise<void> {},
  };
}

export async function closePostgresHarnessShared(): Promise<void> {
  if (!shared) {
    return;
  }
  const current = shared;
  shared = undefined;
  await current.pool.end().catch(() => undefined);
  await current.admin
    .query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [TEST_DB])
    .catch(() => undefined);
  await current.admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`).catch(() => undefined);
  await current.admin.end().catch(() => undefined);
}
