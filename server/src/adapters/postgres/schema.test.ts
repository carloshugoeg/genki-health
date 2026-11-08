import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresCatalogoRepository } from './catalogo-repository.js';
import { PostgresIdPort } from './id.js';
import {
  fromPgDate,
  fromPgNumeric,
  fromPgTimestamptz,
  toPgDate,
  toPgTimestamptz,
} from './mapper.js';
import { activePostgresClient, PostgresUnitOfWork } from './unit-of-work.js';

const TEST_DB = 'genki_test_postgres_schema';
const INSTITUTION_ID = 1;
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

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

describe('PostgreSQL schema, mapper and scoped UoW (E2-P3A-02)', () => {
  let admin: pg.Client;
  let pool: pg.Pool;
  let client: pg.Client;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: requireAdminUrl() });
    await admin.connect();
    await recreateTestDatabase(admin);

    const adminUrl = new URL(requireAdminUrl());
    adminUrl.pathname = `/${TEST_DB}`;
    client = new pg.Client({ connectionString: adminUrl.toString() });
    await client.connect();
    await applyMigrations(client);

    pool = new pg.Pool({
      connectionString: adminUrl.toString(),
      max: 5,
    });
  }, 60_000);

  beforeEach(async () => {
    await client.query(
      'TRUNCATE municipio, especialidad, institucion, medicamento, id_counter CASCADE',
    );
    await client.query(`INSERT INTO id_counter VALUES ('receta_folio', 1)`);
  }, 30_000);

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    await client?.end().catch(() => undefined);
    if (admin) {
      await admin
        .query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [
          TEST_DB,
        ])
        .catch(() => undefined);
      await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`).catch(() => undefined);
      await admin.end().catch(() => undefined);
    }
  }, 30_000);

  it('postgres_migrations_apply_c4_split', async () => {
    expect(migrationFiles()).toEqual([
      '0001-core.sql',
      '0002-identity.sql',
      '0003-hospital-locks.sql',
    ]);

    const coreTables = [
      'institucion',
      'municipio',
      'paciente',
      'expediente',
      'consulta',
      'id_counter',
    ];
    for (const table of coreTables) {
      const found = await client.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
      expect(found.rows[0]?.reg, `${table} from 0001-core`).toBe(table);
    }

    for (const table of ['rol', 'usuario', 'auth_session']) {
      const found = await client.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
      expect(found.rows[0]?.reg, `${table} from 0002-identity`).toBe(table);
    }

    for (const table of ['servicio', 'cama', 'admision', 'nota_evolucion']) {
      const found = await client.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
      expect(found.rows[0]?.reg, `${table} from 0003-hospital-locks`).toBe(table);
    }

    const view = await client.query(`SELECT to_regclass($1) AS reg`, ['public.reporte_pacientes']);
    expect(view.rows[0]?.reg).toBe('reporte_pacientes');

    const counter = await client.query(
      `SELECT siguiente FROM id_counter WHERE nombre = 'receta_folio'`,
    );
    expect(Number(counter.rows[0]?.siguiente)).toBe(1);

    const principal = await client.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_responsable_principal'`,
    );
    expect(principal.rows[0]?.indexdef).toMatch(/WHERE.*es_principal/i);
  });

  it('postgres_types_map_to_dto', async () => {
    await client.query(
      `INSERT INTO institucion (id_institucion, nombre, tipo, nit, direccion, telefono, correo, motor_datos)
       VALUES (1, 'Hospital Demo', 'hospital', 'NIT-1', 'Calle 1', '000', 'h@example.invalid', 'postgres')`,
    );
    await client.query(`INSERT INTO municipio (id_municipio, nombre) VALUES (1, 'Guatemala')`);
    await client.query(
      `INSERT INTO paciente (
         id_institucion, tipo_documento, numero_documento, primer_nombre, primer_apellido,
         fecha_nacimiento, sexo, fecha_registro, estado
       ) VALUES (
         1, 'DPI', 'DEMO-1', 'Ana', 'López',
         $1::date, 'F', $2::timestamptz, 'activo'
       )`,
      [toPgDate('1990-05-15'), toPgTimestamptz('2026-11-01T20:00:00.000Z')],
    );
    await client.query(
      `INSERT INTO medicamento (
         id_medicamento, nombre_generico, principio_activo, concentracion,
         forma_farmaceutica, presentacion, requiere_receta, activo
       ) VALUES (1, 'Amox', 'amoxicilina', '500mg', 'capsula', 'caja', true, true)`,
    );

    const numericProbe = await client.query(`SELECT $1::numeric(8,2) AS cantidad`, ['1.50']);
    expect(fromPgNumeric(numericProbe.rows[0].cantidad)).toBe(1.5);

    const row = await client.query(
      `SELECT fecha_nacimiento, fecha_registro FROM paciente WHERE numero_documento = 'DEMO-1'`,
    );
    expect(fromPgDate(row.rows[0].fecha_nacimiento)).toBe('1990-05-15');
    expect(fromPgTimestamptz(row.rows[0].fecha_registro)).toBe('2026-11-01T20:00:00.000Z');
  });

  it('postgres_ids_are_integers', async () => {
    const uow = new PostgresUnitOfWork(pool);
    const ids = new PostgresIdPort();

    const allocated = await uow.runInTransaction(async () => {
      expect(activePostgresClient()).toBeDefined();
      return ids.nextInt('receta_folio');
    });
    expect(allocated).toBe(1);
    expect(Number.isInteger(allocated)).toBe(true);

    const counter = await client.query(
      `SELECT siguiente FROM id_counter WHERE nombre = 'receta_folio'`,
    );
    expect(Number(counter.rows[0]?.siguiente)).toBe(2);

    await client.query(
      `INSERT INTO institucion (id_institucion, nombre, tipo, nit, direccion, telefono, correo, motor_datos)
       VALUES (1, 'Hospital Demo', 'hospital', 'NIT-1', 'Calle 1', '000', 'h@example.invalid', 'postgres')`,
    );
    const inserted = await client.query(
      `INSERT INTO profesional (id_institucion, nombres, apellidos, activo)
       VALUES (1, 'Dr', 'Demo', true) RETURNING id_profesional`,
    );
    expect(typeof inserted.rows[0].id_profesional).toBe('number');
    expect(Number.isInteger(inserted.rows[0].id_profesional)).toBe(true);
  });

  it('postgres_transaction_failure_aborts', async () => {
    const uow = new PostgresUnitOfWork(pool);

    await client.query(`INSERT INTO municipio (id_municipio, nombre) VALUES (1, 'Antes')`);

    await expect(
      uow.runInTransaction(async () => {
        const tx = activePostgresClient();
        expect(tx).toBeDefined();
        await tx!.query(`INSERT INTO municipio (id_municipio, nombre) VALUES (2, 'Abortado')`);
        await uow.runInTransaction(async () => {
          expect(activePostgresClient()).toBe(tx);
        });
        throw new Error('forced abort');
      }),
    ).rejects.toThrow(/forced abort/);

    const count = await client.query(`SELECT COUNT(*)::int AS n FROM municipio`);
    expect(count.rows[0].n).toBe(1);

    await uow.runInTransaction(async () => {
      const tx = activePostgresClient();
      await tx!.query(`INSERT INTO municipio (id_municipio, nombre) VALUES (2, 'Persistido')`);
    });
    const after = await client.query(`SELECT COUNT(*)::int AS n FROM municipio`);
    expect(after.rows[0].n).toBe(2);

    await client.query(
      `INSERT INTO institucion (id_institucion, nombre, tipo, nit, direccion, telefono, correo, motor_datos)
       VALUES (1, 'Hospital Demo', 'hospital', 'NIT-1', 'Calle 1', '000', 'h@example.invalid', 'postgres')`,
    );
    await client.query(
      `INSERT INTO profesional (id_institucion, nombres, apellidos, activo)
       VALUES (1, 'Dr', 'Activo', true), (1, 'Dr', 'Inactivo', false)`,
    );
    await client.query(
      `INSERT INTO medicamento (
         id_medicamento, nombre_generico, principio_activo, concentracion,
         forma_farmaceutica, presentacion, requiere_receta, activo
       ) VALUES
         (1, 'Amox', 'amoxicilina', '500mg', 'capsula', 'caja', true, true),
         (2, 'Old', 'x', '1mg', 'tab', 'caja', false, false)`,
    );

    const catalogos = new PostgresCatalogoRepository(INSTITUTION_ID);
    const listed = await catalogos.list();
    expect(listed.municipios.map((m) => m.id_municipio)).toEqual([1, 2]);
    expect(listed.profesionales).toHaveLength(1);
    expect(listed.profesionales[0]?.nombres).toBe('Dr');
    expect(listed.medicamentos).toHaveLength(1);
    expect(listed.medicamentos[0]?.nombre_generico).toBe('Amox');
  });
});
