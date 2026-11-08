import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import mysql from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  installMysqlSecurity,
  MYSQL_APP_USER,
  MYSQL_REPORT_USER,
  MYSQL_REPORT_VIEW,
  mysqlAuthenticatedUrl,
} from '../../src/adapters/mysql/security.js';

const TEST_DB = 'genki_test_mysql_security';
const INSTITUTION_ID = 2;
const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/adapters/mysql/migrations',
);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env: ${name} (physical MySQL required)`);
  }
  return value;
}

function requireAdminUrl(): string {
  return requireEnv('MYSQL_ADMIN_URL');
}

function isAccessDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { errno?: number; code?: string }).errno;
  if (code === 1142 || code === 1227 || code === 1044 || code === 1370) {
    return true;
  }
  const sqlState = String((error as { code?: string }).code ?? '');
  if (sqlState === 'ER_TABLEACCESS_DENIED_ERROR' || sqlState === 'ER_DBACCESS_DENIED_ERROR') {
    return true;
  }
  const message = String((error as { message?: string }).message ?? error);
  return /denied|command denied|DROP command denied/i.test(message);
}

function isConstraintRejected(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { errno?: number }).errno;
  // 1062 duplicate key; 3819 CHECK constraint
  if (code === 1062 || code === 3819) {
    return true;
  }
  const message = String((error as { message?: string }).message ?? error);
  return /Duplicate entry|Check constraint/i.test(message);
}

async function applyMigrations(connection: Connection): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    await connection.query(sql);
  }
}

async function seedMinimal(admin: Connection): Promise<void> {
  await admin.query(
    `INSERT INTO institucion (
       id_institucion, nombre, tipo, nit, direccion, telefono, correo, motor_datos
     ) VALUES (?, 'Pediatrico Security', 'centro_pediatrico', 'NIT-SEC', 'Calle', '000',
               'sec@example.invalid', 'mysql')
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
    [INSTITUTION_ID],
  );
  await admin.query(
    `INSERT INTO municipio (id_municipio, nombre) VALUES (1, 'Municipio de prueba')
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`,
  );
  await admin.query(
    `INSERT INTO profesional (id_profesional, id_institucion, nombres, apellidos, numero_colegiado, activo)
     VALUES (1, ?, 'Profesional', 'Simulado', 'DEMO-2-1', TRUE)
     ON DUPLICATE KEY UPDATE numero_colegiado = VALUES(numero_colegiado), activo = TRUE`,
    [INSTITUTION_ID],
  );
}

describe('MySQL app/report permissions (E2-P3B-04)', () => {
  let admin: Connection;
  let appUrl: string;
  let reportUrl: string;

  beforeAll(async () => {
    const appPassword = requireEnv('APP_DB_PASSWORD');
    const reportPassword = requireEnv('REPORT_DB_PASSWORD');
    admin = await mysql.createConnection({
      uri: requireAdminUrl(),
      multipleStatements: true,
    });
    await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await admin.query(
      `CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci`,
    );
    await admin.changeUser({ database: TEST_DB });
    await admin.query(`SET time_zone = '+00:00'`);
    await applyMigrations(admin);
    await installMysqlSecurity(admin, {
      database: TEST_DB,
      appPassword,
      reportPassword,
    });
    appUrl = mysqlAuthenticatedUrl({
      adminUrl: requireAdminUrl(),
      database: TEST_DB,
      user: MYSQL_APP_USER,
      password: appPassword,
    });
    reportUrl = mysqlAuthenticatedUrl({
      adminUrl: requireAdminUrl(),
      database: TEST_DB,
      user: MYSQL_REPORT_USER,
      password: reportPassword,
    });
  }, 60_000);

  beforeEach(async () => {
    await admin.query('SET FOREIGN_KEY_CHECKS = 0');
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
      'municipio',
      'institucion',
    ]) {
      await admin.query(`TRUNCATE TABLE \`${table}\``);
    }
    await admin.query('SET FOREIGN_KEY_CHECKS = 1');
    await seedMinimal(admin);
  }, 30_000);

  afterAll(async () => {
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``).catch(() => undefined);
      await admin.end().catch(() => undefined);
    }
  }, 30_000);

  it('mysql_app_cannot_delete_or_drop', async () => {
    await admin.query(
      `INSERT INTO paciente (
         id_institucion, tipo_documento, numero_documento, primer_nombre, primer_apellido,
         fecha_nacimiento, sexo, estado
       ) VALUES (?, 'DPI', 'SEC-1', 'Paciente', 'Seguridad', '2015-01-01', 'X', 'activo')`,
      [INSTITUTION_ID],
    );

    const app = await mysql.createConnection({ uri: appUrl, timezone: 'Z' });
    try {
      await expect(
        app.query(`DELETE FROM paciente WHERE numero_documento = 'SEC-1'`),
      ).rejects.toSatisfy(isAccessDenied);
      await expect(app.query(`DROP TABLE paciente`)).rejects.toSatisfy(isAccessDenied);
    } finally {
      await app.end();
    }
  });

  it('mysql_reporter_only_reads_aggregate', async () => {
    await admin.query(
      `INSERT INTO paciente (
         id_institucion, tipo_documento, numero_documento, primer_nombre, primer_apellido,
         fecha_nacimiento, sexo, estado
       ) VALUES
         (?, 'DPI', 'SEC-10', 'A', 'Uno', '2014-01-01', 'X', 'activo'),
         (?, 'DPI', 'SEC-11', 'B', 'Dos', '2014-02-01', 'X', 'activo'),
         (?, 'DPI', 'SEC-12', 'C', 'Tres', '2014-03-01', 'X', 'inactivo')`,
      [INSTITUTION_ID, INSTITUTION_ID, INSTITUTION_ID],
    );

    const reporter = await mysql.createConnection({ uri: reportUrl, timezone: 'Z' });
    try {
      const [rows] = await reporter.query<RowDataPacket[]>(
        `SELECT * FROM \`${MYSQL_REPORT_VIEW}\``,
      );
      expect(rows.length).toBeGreaterThanOrEqual(2);
      for (const row of rows) {
        const keys = Object.keys(row).sort();
        expect(keys).toEqual(['cantidad', 'estado', 'id_institucion']);
        expect(row).not.toHaveProperty('numero_documento');
        expect(row).not.toHaveProperty('primer_nombre');
        expect(row).not.toHaveProperty('correo');
      }
      const activo = rows.find((row) => row.estado === 'activo');
      const inactivo = rows.find((row) => row.estado === 'inactivo');
      expect(Number(activo?.cantidad)).toBe(2);
      expect(Number(inactivo?.cantidad)).toBe(1);

      await expect(reporter.query(`SELECT * FROM paciente`)).rejects.toSatisfy(isAccessDenied);
    } finally {
      await reporter.end();
    }
  });

  it('mysql_reporter_cannot_read_diagnosis', async () => {
    await admin.query(
      `INSERT INTO catalogo_cie10 (codigo_cie10, descripcion) VALUES ('Z00.0', 'Examen general')
       ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion)`,
    );
    await admin.query(
      `INSERT INTO paciente (
         id_institucion, tipo_documento, numero_documento, primer_nombre, primer_apellido,
         fecha_nacimiento, sexo, estado
       ) VALUES (?, 'DPI', 'SEC-20', 'Diag', 'Paciente', '2013-01-01', 'X', 'activo')`,
      [INSTITUTION_ID],
    );
    const [pacienteRows] = await admin.query<RowDataPacket[]>(
      `SELECT id_paciente FROM paciente WHERE numero_documento = 'SEC-20'`,
    );
    const idPaciente = Number(pacienteRows[0]?.id_paciente);
    await admin.query(
      `INSERT INTO expediente (id_paciente, numero_expediente, estado)
       VALUES (?, 'EXP-SEC-20', 'activo')`,
      [idPaciente],
    );
    const [expedienteRows] = await admin.query<RowDataPacket[]>(
      `SELECT id_expediente FROM expediente WHERE numero_expediente = 'EXP-SEC-20'`,
    );
    const idExpediente = Number(expedienteRows[0]?.id_expediente);
    await admin.query(
      `INSERT INTO consulta (
         id_expediente, id_profesional, fecha_hora_inicio, fecha_hora_fin, tipo,
         motivo_consulta, estado
       ) VALUES (?, 1, '2026-11-07 15:00:00.000', '2026-11-07 15:30:00.000',
                 'primera_vez', 'control', 'cerrada')`,
      [idExpediente],
    );
    const [consultaRows] = await admin.query<RowDataPacket[]>(
      `SELECT id_consulta FROM consulta WHERE id_expediente = ?`,
      [idExpediente],
    );
    const idConsulta = Number(consultaRows[0]?.id_consulta);
    await admin.query(
      `INSERT INTO diagnostico (
         id_consulta, codigo_cie10, descripcion, tipo, es_principal, fecha_registro
       ) VALUES (?, 'Z00.0', 'Examen general', 'presuntivo', TRUE, '2026-11-07 15:05:00.000')`,
      [idConsulta],
    );

    const reporter = await mysql.createConnection({ uri: reportUrl, timezone: 'Z' });
    try {
      await expect(reporter.query(`SELECT * FROM diagnostico`)).rejects.toSatisfy(isAccessDenied);
    } finally {
      await reporter.end();
    }
  });

  it('mysql_blank_or_duplicate_colegiado_rejected', async () => {
    await expect(
      admin.query(
        `INSERT INTO profesional (id_institucion, nombres, apellidos, numero_colegiado, activo)
         VALUES (?, 'Blank', 'Colegiado', '', TRUE)`,
        [INSTITUTION_ID],
      ),
    ).rejects.toSatisfy(isConstraintRejected);

    await expect(
      admin.query(
        `INSERT INTO profesional (id_institucion, nombres, apellidos, numero_colegiado, activo)
         VALUES (?, 'Dup', 'Colegiado', 'DEMO-2-1', TRUE)`,
        [INSTITUTION_ID],
      ),
    ).rejects.toSatisfy(isConstraintRejected);
  });
});
