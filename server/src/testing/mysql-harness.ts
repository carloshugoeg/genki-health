import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CloseConsultaRequest,
  ConsultaCompleta,
  InstitutionKind,
  PacienteId,
} from '@genki/shared';
import { asInstitutionId } from '@genki/shared';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import mysql from 'mysql2/promise';
import { createMysqlAdapterSet } from '../adapters/mysql/index.js';
import {
  installMysqlSecurity,
  MYSQL_APP_USER,
  mysqlAuthenticatedUrl,
} from '../adapters/mysql/security.js';
import { closeConsulta } from '../application/close-consulta.js';
import type { PersistenceCheckpoint } from '../ports/adapter-resource.js';
import type { ClinicalContext } from '../ports/clinical-context.js';
import type { CloseConsultaBundle } from '../ports/consulta-repository.js';
import {
  defaultKind,
  expectedInstitution99Catalog,
  expectedPrimaryCatalog,
  OTHER_INSTITUTION_ID,
  SEED_CIE10,
  SEED_MUNICIPIO_ID,
} from './catalog-seeds.js';
import type {
  ClinicalHarness,
  ContractClinicalContext,
  ContractConsultaRepository,
  CountSnapshot,
  FailurePoint,
} from './harness.js';

const TEST_DB = 'genki_test_mysql_contract';
const PRIMARY_INSTITUTION = 2;
const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../adapters/mysql/migrations',
);

function requireAdminUrl(): string {
  const url = process.env.MYSQL_ADMIN_URL;
  if (!url) {
    throw new Error('missing required env: MYSQL_ADMIN_URL (physical MySQL required)');
  }
  return url;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env: ${name} (physical MySQL required)`);
  }
  return value;
}

function testDatabaseUrl(): string {
  return mysqlAuthenticatedUrl({
    adminUrl: requireAdminUrl(),
    database: TEST_DB,
    user: MYSQL_APP_USER,
    password: requireEnv('APP_DB_PASSWORD'),
  });
}

const fixedClock = {
  nowIso(): string {
    return '2026-11-07T16:00:00.000Z';
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

function asContractContext(context: ClinicalContext): ContractClinicalContext {
  return {
    pacientes: context.pacientes,
    consultas: facadeConsultas(context),
    catalogos: context.catalogos,
    unitOfWork: context.unitOfWork,
    clock: context.clock,
    ids: context.ids,
  };
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

async function applyMigrations(connection: mysql.Connection): Promise<void> {
  for (const file of migrationFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    await connection.query(sql);
  }
}

async function recreateTestDatabase(admin: mysql.Connection): Promise<void> {
  await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await admin.query(
    `CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci`,
  );
}

async function seedInstitution(pool: Pool, institutionId: number): Promise<void> {
  const catalog =
    institutionId === OTHER_INSTITUTION_ID
      ? expectedInstitution99Catalog()
      : expectedPrimaryCatalog();
  const nombre =
    institutionId === OTHER_INSTITUTION_ID ? 'Institucion 99 Test' : 'Pediatrico Demo Test';
  const nit = institutionId === OTHER_INSTITUTION_ID ? 'NIT-99' : 'NIT-2';
  await pool.query(
    `INSERT INTO institucion (
       id_institucion, nombre, tipo, nit, direccion, telefono, correo, motor_datos
     ) VALUES (?, ?, 'centro_pediatrico', ?, 'Calle Test', '000', ?, 'mysql')
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
    [institutionId, nombre, nit, `i${institutionId}@example.invalid`],
  );
  await pool.query(
    `INSERT INTO municipio (id_municipio, nombre) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
    [SEED_MUNICIPIO_ID, catalog.municipios[0]!.nombre],
  );
  for (const row of catalog.profesionales) {
    await pool.query(
      `INSERT INTO profesional (id_profesional, id_institucion, nombres, apellidos, activo)
       VALUES (?, ?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE nombres = VALUES(nombres), apellidos = VALUES(apellidos), activo = TRUE`,
      [row.id_profesional, institutionId, row.nombres, row.apellidos],
    );
  }
  for (const row of catalog.medicamentos) {
    await pool.query(
      `INSERT INTO medicamento (
         id_medicamento, nombre_generico, principio_activo, concentracion,
         forma_farmaceutica, presentacion, requiere_receta, activo
       ) VALUES (?, ?, 'demo', '1mg', 'tableta', 'caja', TRUE, TRUE)
       ON DUPLICATE KEY UPDATE nombre_generico = VALUES(nombre_generico), activo = TRUE`,
      [row.id_medicamento, row.nombre_generico],
    );
  }
  await pool.query(
    `INSERT INTO catalogo_cie10 (codigo_cie10, descripcion) VALUES (?, 'Examen general')
     ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion)`,
    [SEED_CIE10],
  );
}

async function clearClinical(pool: Pool): Promise<void> {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of [
    'detalle_receta',
    'receta',
    'tratamiento',
    'diagnostico',
    'consulta',
    'responsable',
    'expediente',
    'paciente',
  ]) {
    await pool.query(`TRUNCATE TABLE \`${table}\``);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function countsFor(pool: Pool, institutionId: number): Promise<CountSnapshot> {
  const [pacientes] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM paciente WHERE id_institucion = ?`,
    [institutionId],
  );
  const [expedientes] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n
       FROM expediente e
       INNER JOIN paciente p ON p.id_paciente = e.id_paciente
      WHERE p.id_institucion = ?`,
    [institutionId],
  );
  const [responsables] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n
       FROM responsable r
       INNER JOIN paciente p ON p.id_paciente = r.id_paciente
      WHERE p.id_institucion = ?`,
    [institutionId],
  );
  const [consultas] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n
       FROM consulta c
       INNER JOIN expediente e ON e.id_expediente = c.id_expediente
       INNER JOIN paciente p ON p.id_paciente = e.id_paciente
      WHERE p.id_institucion = ?`,
    [institutionId],
  );
  const [diagnosticos] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n
       FROM diagnostico d
       INNER JOIN consulta c ON c.id_consulta = d.id_consulta
       INNER JOIN expediente e ON e.id_expediente = c.id_expediente
       INNER JOIN paciente p ON p.id_paciente = e.id_paciente
      WHERE p.id_institucion = ?`,
    [institutionId],
  );
  const [tratamientos] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n
       FROM tratamiento t
       INNER JOIN diagnostico d ON d.id_diagnostico = t.id_diagnostico
       INNER JOIN consulta c ON c.id_consulta = d.id_consulta
       INNER JOIN expediente e ON e.id_expediente = c.id_expediente
       INNER JOIN paciente p ON p.id_paciente = e.id_paciente
      WHERE p.id_institucion = ?`,
    [institutionId],
  );
  const [recetas] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n
       FROM receta r
       INNER JOIN consulta c ON c.id_consulta = r.id_consulta
       INNER JOIN expediente e ON e.id_expediente = c.id_expediente
       INNER JOIN paciente p ON p.id_paciente = e.id_paciente
      WHERE p.id_institucion = ?`,
    [institutionId],
  );
  const [detalles] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n
       FROM detalle_receta dr
       INNER JOIN receta r ON r.id_receta = dr.id_receta
       INNER JOIN consulta c ON c.id_consulta = r.id_consulta
       INNER JOIN expediente e ON e.id_expediente = c.id_expediente
       INNER JOIN paciente p ON p.id_paciente = e.id_paciente
      WHERE p.id_institucion = ?`,
    [institutionId],
  );
  return {
    pacientes: Number(pacientes[0]?.n ?? 0),
    expedientes: Number(expedientes[0]?.n ?? 0),
    responsables: Number(responsables[0]?.n ?? 0),
    consultas: Number(consultas[0]?.n ?? 0),
    diagnosticos: Number(diagnosticos[0]?.n ?? 0),
    tratamientos: Number(tratamientos[0]?.n ?? 0),
    recetas: Number(recetas[0]?.n ?? 0),
    detalles: Number(detalles[0]?.n ?? 0),
  };
}

let sharedAdmin: mysql.Connection | null = null;
let sharedPool: Pool | null = null;
let schemaReady = false;
const openResources: Array<{ close(): Promise<void> }> = [];

async function sharedConnection(): Promise<Pool> {
  if (sharedPool && schemaReady) {
    return sharedPool;
  }
  const admin = await mysql.createConnection({
    uri: requireAdminUrl(),
    multipleStatements: true,
  });
  await recreateTestDatabase(admin);
  const migrator = await mysql.createConnection({
    uri: requireAdminUrl(),
    database: TEST_DB,
    multipleStatements: true,
    timezone: 'Z',
  });
  await migrator.query(`SET time_zone = '+00:00'`);
  await applyMigrations(migrator);
  await installMysqlSecurity(migrator, {
    database: TEST_DB,
    appPassword: requireEnv('APP_DB_PASSWORD'),
    reportPassword: requireEnv('REPORT_DB_PASSWORD'),
  });
  await migrator.end();

  // Admin pool for truncate/seed/counts; clinical adapters use app DSN separately.
  const pool = mysql.createPool({
    uri: requireAdminUrl(),
    database: TEST_DB,
    connectionLimit: 5,
    timezone: 'Z',
  });
  sharedAdmin = admin;
  sharedPool = pool;
  schemaReady = true;
  return pool;
}

export async function makeMysqlClinicalHarness(options?: {
  kind?: InstitutionKind;
}): Promise<ClinicalHarness> {
  const kind = options?.kind ?? defaultKind();
  const pool = await sharedConnection();
  let pending: FailurePoint | null = null;
  const afterWrite = (point: PersistenceCheckpoint): void => {
    if (pending === point) {
      pending = null;
      throw new Error(`checkpoint ${point}`);
    }
  };

  const primary = await createMysqlAdapterSet({
    id_institucion: asInstitutionId(PRIMARY_INSTITUTION),
    kind,
    url: testDatabaseUrl(),
    clock: fixedClock,
    afterWrite,
  });
  openResources.push(primary);

  await clearClinical(pool);
  await seedInstitution(pool, PRIMARY_INSTITUTION);
  await seedInstitution(pool, OTHER_INSTITUTION_ID);

  return {
    context: asContractContext(primary.set),
    async reset(): Promise<void> {
      pending = null;
      await clearClinical(pool);
      await seedInstitution(pool, PRIMARY_INSTITUTION);
      await seedInstitution(pool, OTHER_INSTITUTION_ID);
    },
    failNext(point: FailurePoint): void {
      pending = point;
    },
    async counts(): Promise<CountSnapshot> {
      return countsFor(pool, PRIMARY_INSTITUTION);
    },
    async otherInstitution(): Promise<ContractClinicalContext> {
      const other = await createMysqlAdapterSet({
        id_institucion: asInstitutionId(OTHER_INSTITUTION_ID),
        kind,
        url: testDatabaseUrl(),
        clock: fixedClock,
        afterWrite,
      });
      openResources.push(other);
      return asContractContext(other.set);
    },
    async close(): Promise<void> {
      pending = null;
    },
  };
}

export async function closeMysqlHarnessSharedClient(): Promise<void> {
  while (openResources.length > 0) {
    const resource = openResources.pop();
    if (resource) {
      await resource.close().catch(() => undefined);
    }
  }
  if (sharedPool) {
    await sharedPool.end().catch(() => undefined);
    sharedPool = null;
  }
  if (sharedAdmin) {
    await sharedAdmin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``).catch(() => undefined);
    await sharedAdmin.end().catch(() => undefined);
    sharedAdmin = null;
  }
  schemaReady = false;
}
