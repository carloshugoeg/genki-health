import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { bootstrapEngine } from '../../../scripts/db-bootstrap.js';

const TEST_DB = 'genki_test_postgres_security';
const MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/adapters/postgres/migrations',
);

let serverAdmin: pg.Client;
let owner: pg.Client;
let app: pg.Client;
let identity: pg.Client;
let report: pg.Client;
let priorAdminUrl: string | undefined;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env: ${name}`);
  return value;
}

function databaseUrl(source: string, database: string, user?: string, password?: string): string {
  const url = new URL(source);
  url.pathname = `/${database}`;
  if (user) url.username = user;
  if (password) url.password = password;
  return url.toString();
}

async function expectDenied(work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
    throw new Error('operation unexpectedly succeeded');
  } catch (error) {
    expect((error as { code?: string }).code).toBe('42501');
  }
}

beforeAll(async () => {
  const adminUrl = required('PG_ADMIN_URL');
  required('APP_DB_PASSWORD');
  required('IDENTITY_DB_PASSWORD');
  required('REPORT_DB_PASSWORD');
  required('POSTGRES_PASSWORD');

  serverAdmin = new pg.Client({ connectionString: adminUrl });
  await serverAdmin.connect();
  await serverAdmin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
    [TEST_DB],
  );
  await serverAdmin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await serverAdmin.query(`CREATE DATABASE ${TEST_DB}`);

  const ownerUrl = databaseUrl(adminUrl, TEST_DB);
  owner = new pg.Client({ connectionString: ownerUrl });
  await owner.connect();
  for (const file of readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await owner.query(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }

  priorAdminUrl = process.env.PG_ADMIN_URL;
  process.env.PG_ADMIN_URL = ownerUrl;
  await bootstrapEngine('postgres');

  const appUrl = databaseUrl(adminUrl, TEST_DB, 'genki_app_login', required('APP_DB_PASSWORD'));
  const identityUrl = databaseUrl(
    adminUrl,
    TEST_DB,
    'genki_identity_login',
    required('IDENTITY_DB_PASSWORD'),
  );
  const reportUrl = databaseUrl(
    adminUrl,
    TEST_DB,
    'genki_report_login',
    required('REPORT_DB_PASSWORD'),
  );
  app = new pg.Client({ connectionString: appUrl });
  identity = new pg.Client({ connectionString: identityUrl });
  report = new pg.Client({ connectionString: reportUrl });
  await Promise.all([app.connect(), identity.connect(), report.connect()]);
});

afterAll(async () => {
  await Promise.all([
    app?.end().catch(() => undefined),
    identity?.end().catch(() => undefined),
    report?.end().catch(() => undefined),
    owner?.end().catch(() => undefined),
  ]);
  if (serverAdmin) {
    await serverAdmin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
      [TEST_DB],
    );
    await serverAdmin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
    await serverAdmin.end();
  }
  if (priorAdminUrl == null) delete process.env.PG_ADMIN_URL;
  else process.env.PG_ADMIN_URL = priorAdminUrl;
});

it('pg_app_cannot_delete_or_ddl', async () => {
  await owner.query(
    `INSERT INTO institucion
      (id_institucion,nombre,tipo,nit,direccion,telefono,correo,motor_datos)
     VALUES (1,'Hospital','hospital','NIT-1','x','x','x@example.invalid','postgres')`,
  );
  const patient = await app.query<{ id_paciente: number }>(
    `INSERT INTO paciente
      (id_institucion,tipo_documento,numero_documento,primer_nombre,primer_apellido,
       fecha_nacimiento,sexo,estado)
     VALUES (1,'DPI','DOC-1','Paciente','Prueba','2000-01-01','X','activo')
     RETURNING id_paciente`,
  );
  await app.query(
    `INSERT INTO expediente (id_paciente,numero_expediente,estado)
     VALUES ($1,'EXP-1','activo')`,
    [patient.rows[0]!.id_paciente],
  );
  await app.query('SELECT * FROM expediente FOR UPDATE');
  await expectDenied(() => app.query('DELETE FROM paciente'));
  await expectDenied(() => app.query('CREATE TABLE forbidden_table (id integer)'));
});

it('pg_reporter_cannot_read_patient_or_hash', async () => {
  await expect(report.query('SELECT * FROM reporte_pacientes')).resolves.toBeDefined();
  await expectDenied(() => report.query('SELECT * FROM paciente'));
  await expectDenied(() => report.query('SELECT hash_contrasena FROM usuario'));
});

it('pg_identity_cannot_read_clinical', async () => {
  await owner.query(`INSERT INTO rol (id_rol,nombre) VALUES (1,'administrador')`);
  await owner.query(
    `INSERT INTO usuario
      (id_institucion,id_rol,nombre_usuario,correo,hash_contrasena,estado)
     VALUES (1,1,'demo-1','demo-1@example.invalid','argon2id-test-placeholder','activo')`,
  );
  await identity.query(
    `INSERT INTO auth_session (jti_hash,id_usuario,expires_at,created_at)
     VALUES (repeat('a',64),1,now()+interval '1 day',now())`,
  );
  await identity.query(`UPDATE auth_session SET revoked_at=now() WHERE jti_hash=repeat('a',64)`);
  await expect(identity.query('SELECT * FROM usuario')).resolves.toBeDefined();
  await expectDenied(() => identity.query('SELECT * FROM paciente'));
  await expectDenied(() => identity.query('SELECT * FROM diagnostico'));
});

it('pg_nullable_colegiado_unique', async () => {
  await owner.query(
    `INSERT INTO profesional (id_institucion,numero_colegiado,nombres,apellidos)
     VALUES (1,NULL,'Uno','Prueba'),(1,NULL,'Dos','Prueba'),(1,'COL-1','Tres','Prueba')`,
  );
  await expect(
    owner.query(
      `INSERT INTO profesional (id_institucion,numero_colegiado,nombres,apellidos)
       VALUES (1,'COL-1','Cuatro','Prueba')`,
    ),
  ).rejects.toMatchObject({ code: '23505' });
});
