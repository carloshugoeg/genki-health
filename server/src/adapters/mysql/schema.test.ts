import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import mysql from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MysqlCatalogoRepository } from './catalogo-repository.js';
import { MysqlIdPort } from './id.js';
import {
  fromMysqlDate,
  fromMysqlDatetime,
  fromMysqlDecimal,
  toMysqlDate,
  toMysqlDatetime,
} from './mapper.js';
import { activeMysqlConnection, MysqlUnitOfWork } from './unit-of-work.js';

const TEST_DB = 'genki_test_mysql_schema';
const INSTITUTION_ID = 1;
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

function requireAdminUrl(): string {
  const url = process.env.MYSQL_ADMIN_URL;
  if (!url) {
    throw new Error('missing required env: MYSQL_ADMIN_URL (physical MySQL required)');
  }
  return url;
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

describe('MySQL schema, mapper and scoped UoW (E2-P3B-01)', () => {
  let admin: mysql.Connection;
  let pool: mysql.Pool;
  let connection: mysql.Connection;

  beforeAll(async () => {
    admin = await mysql.createConnection({
      uri: requireAdminUrl(),
      multipleStatements: true,
    });
    await recreateTestDatabase(admin);

    connection = await mysql.createConnection({
      uri: requireAdminUrl(),
      database: TEST_DB,
      multipleStatements: true,
      timezone: 'Z',
    });
    await connection.query(`SET time_zone = '+00:00'`);
    await applyMigrations(connection);

    pool = mysql.createPool({
      uri: requireAdminUrl(),
      database: TEST_DB,
      connectionLimit: 5,
      timezone: 'Z',
    });
  }, 60_000);

  beforeEach(async () => {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of [
      'detalle_receta',
      'receta',
      'tratamiento',
      'diagnostico',
      'consulta',
      'responsable',
      'expediente',
      'paciente',
      'profesional',
      'medicamento',
      'municipio',
      'especialidad',
      'institucion',
      'id_counter',
    ]) {
      await connection.query(`TRUNCATE TABLE \`${table}\``);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.query(`INSERT INTO id_counter VALUES ('receta_folio', 1)`);
  }, 30_000);

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    await connection?.end().catch(() => undefined);
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``).catch(() => undefined);
      await admin.end().catch(() => undefined);
    }
  }, 30_000);

  it('mysql_migrations_apply_c4b', async () => {
    expect(migrationFiles()).toEqual(['0001-core.sql']);

    const coreTables = [
      'institucion',
      'municipio',
      'paciente',
      'expediente',
      'consulta',
      'id_counter',
      'responsable',
      'reporte_pacientes',
    ];
    for (const table of coreTables) {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM information_schema.tables
          WHERE table_schema = ? AND table_name = ?`,
        [TEST_DB, table],
      );
      expect(Number(rows[0]?.n), `${table} from 0001-core`).toBe(1);
    }

    for (const hospitalOnly of ['cama', 'admision', 'nota_evolucion', 'usuario', 'auth_session']) {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM information_schema.tables
          WHERE table_schema = ? AND table_name = ?`,
        [TEST_DB, hospitalOnly],
      );
      expect(Number(rows[0]?.n), `${hospitalOnly} must be absent from C4b`).toBe(0);
    }

    const [counter] = await connection.query<RowDataPacket[]>(
      `SELECT siguiente FROM id_counter WHERE nombre = 'receta_folio'`,
    );
    expect(Number(counter[0]?.siguiente)).toBe(1);

    const [principal] = await connection.query<RowDataPacket[]>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = ? AND table_name = 'responsable' AND column_name = 'principal_paciente'`,
      [TEST_DB],
    );
    expect(principal[0]?.column_name ?? principal[0]?.COLUMN_NAME).toBe('principal_paciente');

    const [engines] = await connection.query<RowDataPacket[]>(
      `SELECT engine FROM information_schema.tables
        WHERE table_schema = ? AND table_name = 'paciente'`,
      [TEST_DB],
    );
    expect(String(engines[0]?.engine ?? engines[0]?.ENGINE)).toBe('InnoDB');
  });

  it('mysql_types_map_to_dto', async () => {
    await connection.query(
      `INSERT INTO institucion (id_institucion, nombre, tipo, nit, direccion, telefono, correo, motor_datos)
       VALUES (1, 'Pediatrica Demo', 'centro_pediatrico', 'NIT-1', 'Calle 1', '000', 'p@example.invalid', 'mysql')`,
    );
    await connection.query(`INSERT INTO municipio (id_municipio, nombre) VALUES (1, 'Guatemala')`);
    await connection.query(
      `INSERT INTO paciente (
         id_institucion, tipo_documento, numero_documento, primer_nombre, primer_apellido,
         fecha_nacimiento, sexo, fecha_registro, estado
       ) VALUES (
         1, 'DPI', 'DEMO-1', 'Ana', 'López',
         ?, 'F', ?, 'activo'
       )`,
      [toMysqlDate('1990-05-15'), toMysqlDatetime('2026-11-01T20:00:00.000Z')],
    );
    await connection.query(
      `INSERT INTO medicamento (
         id_medicamento, nombre_generico, principio_activo, concentracion,
         forma_farmaceutica, presentacion, requiere_receta, activo
       ) VALUES (1, 'Amox', 'amoxicilina', '500mg', 'capsula', 'caja', true, true)`,
    );

    const [numericProbe] = await connection.query<RowDataPacket[]>(
      `SELECT CAST(? AS DECIMAL(8,2)) AS cantidad`,
      ['1.50'],
    );
    expect(fromMysqlDecimal(numericProbe[0]?.cantidad)).toBe(1.5);

    const [row] = await connection.query<RowDataPacket[]>(
      `SELECT fecha_nacimiento, fecha_registro FROM paciente WHERE numero_documento = 'DEMO-1'`,
    );
    expect(fromMysqlDate(row[0]?.fecha_nacimiento)).toBe('1990-05-15');
    expect(fromMysqlDatetime(row[0]?.fecha_registro)).toBe('2026-11-01T20:00:00.000Z');
  });

  it('mysql_ids_are_integers', async () => {
    const uow = new MysqlUnitOfWork(pool);
    const ids = new MysqlIdPort();

    const allocated = await uow.runInTransaction(async () => {
      expect(activeMysqlConnection()).toBeDefined();
      return ids.nextInt('receta_folio');
    });
    expect(allocated).toBe(1);
    expect(Number.isInteger(allocated)).toBe(true);

    const [counter] = await connection.query<RowDataPacket[]>(
      `SELECT siguiente FROM id_counter WHERE nombre = 'receta_folio'`,
    );
    expect(Number(counter[0]?.siguiente)).toBe(2);

    await connection.query(
      `INSERT INTO institucion (id_institucion, nombre, tipo, nit, direccion, telefono, correo, motor_datos)
       VALUES (1, 'Pediatrica Demo', 'centro_pediatrico', 'NIT-1', 'Calle 1', '000', 'p@example.invalid', 'mysql')`,
    );
    const [inserted] = await connection.query<ResultSetHeader>(
      `INSERT INTO profesional (id_institucion, nombres, apellidos, activo)
       VALUES (1, 'Dr', 'Demo', true)`,
    );
    expect(typeof inserted.insertId).toBe('number');
    expect(Number.isInteger(inserted.insertId)).toBe(true);
    expect(inserted.insertId).toBeGreaterThan(0);
  });

  it('mysql_transaction_failure_aborts', async () => {
    const uow = new MysqlUnitOfWork(pool);

    await connection.query(`INSERT INTO municipio (id_municipio, nombre) VALUES (1, 'Antes')`);

    await expect(
      uow.runInTransaction(async () => {
        const tx = activeMysqlConnection();
        expect(tx).toBeDefined();
        await tx!.query(`INSERT INTO municipio (id_municipio, nombre) VALUES (2, 'Abortado')`);
        await uow.runInTransaction(async () => {
          expect(activeMysqlConnection()).toBe(tx);
        });
        throw new Error('forced abort');
      }),
    ).rejects.toThrow(/forced abort/);

    const [count] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM municipio`);
    expect(Number(count[0]?.n)).toBe(1);

    await uow.runInTransaction(async () => {
      const tx = activeMysqlConnection();
      await tx!.query(`INSERT INTO municipio (id_municipio, nombre) VALUES (2, 'Persistido')`);
    });
    const [after] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM municipio`);
    expect(Number(after[0]?.n)).toBe(2);

    await connection.query(
      `INSERT INTO institucion (id_institucion, nombre, tipo, nit, direccion, telefono, correo, motor_datos)
       VALUES (1, 'Pediatrica Demo', 'centro_pediatrico', 'NIT-1', 'Calle 1', '000', 'p@example.invalid', 'mysql')`,
    );
    await connection.query(
      `INSERT INTO profesional (id_institucion, nombres, apellidos, activo)
       VALUES (1, 'Dr', 'Activo', true), (1, 'Dr', 'Inactivo', false)`,
    );
    await connection.query(
      `INSERT INTO medicamento (
         id_medicamento, nombre_generico, principio_activo, concentracion,
         forma_farmaceutica, presentacion, requiere_receta, activo
       ) VALUES
         (1, 'Amox', 'amoxicilina', '500mg', 'capsula', 'caja', true, true),
         (2, 'Old', 'x', '1mg', 'tab', 'caja', false, false)`,
    );

    const catalogos = new MysqlCatalogoRepository(INSTITUTION_ID);
    const listed = await catalogos.list();
    expect(listed.municipios.map((m) => m.id_municipio)).toEqual([1, 2]);
    expect(listed.profesionales).toHaveLength(1);
    expect(listed.profesionales[0]?.nombres).toBe('Dr');
    expect(listed.medicamentos).toHaveLength(1);
    expect(listed.medicamentos[0]?.nombre_generico).toBe('Amox');
  });
});
