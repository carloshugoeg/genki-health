import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const PG = 'docs/plan/ddl/postgres.sql';
const MYSQL = 'docs/plan/ddl/mysql.sql';
const SQL = 'docs/plan/contracts/SQL.md';

function read(rel) {
  const path = join(root, rel);
  assert.ok(existsSync(path), `${rel} must exist`);
  return readFileSync(path, 'utf8');
}

function tableColumns(sql, tableName) {
  const marker = `CREATE TABLE ${tableName}`;
  const start = sql.indexOf(marker);
  assert.ok(start >= 0, `${tableName} CREATE TABLE must exist`);
  const open = sql.indexOf('(', start);
  assert.ok(open >= 0, `${tableName} CREATE TABLE must open a column list`);
  let depth = 0;
  for (let i = open; i < sql.length; i += 1) {
    const ch = sql[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return sql.slice(open + 1, i);
    }
  }
  assert.fail(`${tableName} CREATE TABLE column list must close`);
}

test('municipio_is_real_fk_target', () => {
  const pg = read(PG);
  const mysql = read(MYSQL);
  const contract = read(SQL);

  assert.match(pg, /CREATE TABLE municipio\s*\(/, 'postgres.sql must create municipio');
  assert.match(
    pg,
    /id_municipio INTEGER REFERENCES municipio\(id_municipio\) ON DELETE RESTRICT/,
    'postgres paciente must FK to municipio(id_municipio)',
  );

  assert.match(mysql, /CREATE TABLE municipio\s*\(/, 'mysql.sql must create municipio');
  assert.match(
    mysql,
    /FOREIGN KEY\s*\(\s*id_municipio\s*\)\s*REFERENCES\s+municipio\s*\(\s*id_municipio\s*\)\s*ON DELETE RESTRICT/,
    'mysql paciente must declare FOREIGN KEY to municipio(id_municipio)',
  );

  assert.match(
    contract,
    /MUNICIPIO is a real FK target/i,
    'SQL.md must state MUNICIPIO is a real FK target',
  );
});

test('cama_has_locked_columns', () => {
  const pg = read(PG);
  const mysql = read(MYSQL);
  const contract = read(SQL);
  const cama = tableColumns(pg, 'cama');

  assert.match(cama, /\btipo_cama\b/, 'postgres cama must include tipo_cama');
  assert.match(cama, /\bcodigo_servicio\b/, 'postgres cama must include codigo_servicio');
  assert.match(
    cama,
    /UNIQUE\s*\(\s*id_servicio\s*,\s*codigo\s*\)/,
    'postgres cama must unique(id_servicio,codigo)',
  );

  assert.doesNotMatch(
    mysql,
    /CREATE TABLE cama\s*\(/,
    'mysql.sql must omit hospital-only cama (source §7.5)',
  );
  assert.match(
    contract,
    /CAMA has tipo_cama and codigo_servicio/i,
    'SQL.md must document locked CAMA columns',
  );
});

test('note_has_nullable_self_fk', () => {
  const pg = read(PG);
  const mysql = read(MYSQL);
  const contract = read(SQL);
  const nota = tableColumns(pg, 'nota_evolucion');

  assert.match(
    nota,
    /id_nota_anterior INTEGER REFERENCES nota_evolucion\(id_nota\) ON DELETE RESTRICT/,
    'postgres nota_evolucion must have nullable self-FK id_nota_anterior',
  );
  assert.match(
    pg,
    /CREATE INDEX ix_nota_anterior ON nota_evolucion\(id_nota_anterior\)/,
    'postgres must index id_nota_anterior',
  );

  assert.doesNotMatch(
    mysql,
    /CREATE TABLE nota_evolucion\s*\(/,
    'mysql.sql must omit hospital-only nota_evolucion (source §7.5)',
  );
  assert.match(
    contract,
    /NOTA_EVOLUCION has optional self-FK id_nota_anterior/i,
    'SQL.md must document the evolution-note self-FK',
  );
});

test('professional_omits_locked_b_columns', () => {
  const pg = read(PG);
  const mysql = read(MYSQL);
  const contract = read(SQL);
  const pgProf = tableColumns(pg, 'profesional');
  const mysqlProf = tableColumns(mysql, 'profesional');

  for (const [label, columns] of [
    ['postgres', pgProf],
    ['mysql', mysqlProf],
  ]) {
    assert.doesNotMatch(
      columns,
      /\bid_tipo_personal\b/,
      `${label} profesional must omit locked-B id_tipo_personal`,
    );
    assert.doesNotMatch(
      columns,
      /\bmodalidad_contrato\b/,
      `${label} profesional must omit locked-B modalidad_contrato`,
    );
    assert.doesNotMatch(
      columns,
      /\bfecha_ingreso\b/,
      `${label} profesional must omit locked-B fecha_ingreso`,
    );
    assert.match(
      columns,
      /numero_colegiado VARCHAR\(30\) UNIQUE/,
      `${label} profesional must keep nullable UNIQUE numero_colegiado`,
    );
  }

  assert.match(
    contract,
    /PROFESIONAL omits the three locked-B columns/i,
    'SQL.md must state PROFESIONAL omits locked-B columns',
  );
});

test('mysql_uses_real_foreign_key_clauses', () => {
  const mysql = read(MYSQL);

  const requiredParents = [
    'institucion',
    'especialidad',
    'municipio',
    'paciente',
    'expediente',
    'profesional',
    'consulta',
    'catalogo_cie10',
    'diagnostico',
    'receta',
    'medicamento',
  ];

  for (const parent of requiredParents) {
    assert.match(
      mysql,
      new RegExp(
        `FOREIGN KEY\\s*\\([^)]+\\)\\s*REFERENCES\\s+${parent}\\s*\\([^)]+\\)\\s*ON DELETE RESTRICT`,
      ),
      `mysql.sql must declare FOREIGN KEY ... REFERENCES ${parent}(...) ON DELETE RESTRICT`,
    );
  }

  assert.match(
    mysql,
    /ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci/,
    'mysql.sql must use InnoDB utf8mb4_0900_as_ci',
  );
});
