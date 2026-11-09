import mysql, { type RowDataPacket } from 'mysql2/promise';

interface SeedRow {
  table: string;
  key: string;
  data: Record<string, unknown>;
  preserve?: string[];
}
const tables = new Set([
  'institucion',
  'municipio',
  'especialidad',
  'tipo_personal',
  'profesional',
  'medicamento',
  'catalogo_cie10',
  'paciente',
  'expediente',
  'responsable',
]);
function identifier(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid seed identifier');
  return `\`${name}\``;
}

/** Explicit fixture IDs; InnoDB advances AUTO_INCREMENT on explicit inserts, never resets it. */
export async function seedMysql(url: string, rows: SeedRow[]): Promise<void> {
  const target = new URL(url);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !/^\/genki_test_[a-z0-9_]+$/.test(target.pathname)
  )
    throw new Error('MySQL seed requires a loopback disposable genki_test_ database');
  const connection = await mysql.createConnection({
    uri: url,
    timezone: 'Z',
    dateStrings: true,
    connectTimeout: 5000,
  });
  try {
    await connection.query("SET time_zone = '+00:00'");
    // Dedicated named lock serializes seed commands. Row/unique locks arbitrate clinical inserts.
    const [lock] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK('genki_demo_seed',5) AS acquired",
    );
    if (Number(lock[0]?.acquired) !== 1) throw new Error('Seed already running');
    await connection.beginTransaction();
    for (const { table, key, data, preserve = [] } of rows) {
      if (!tables.has(table)) throw new Error('Invalid seed table');
      const [found] = await connection.query<RowDataPacket[]>(
        `SELECT 1 FROM ${identifier(table)} WHERE ${identifier(key)} = ? FOR UPDATE`,
        [data[key]],
      );
      const entries = Object.entries(data);
      if (found.length) {
        const expected = entries.filter(([column]) => !preserve.includes(column));
        const [matches] = await connection.query<RowDataPacket[]>(
          `SELECT 1 FROM ${identifier(table)} WHERE ${expected.map(([column]) => `${identifier(column)} <=> ?`).join(' AND ')}`,
          expected.map(([, value]) => value),
        );
        if (!matches.length) throw new Error(`Seed fixture conflict in ${table}`);
      } else {
        await connection.query(
          `INSERT INTO ${identifier(table)} (${entries.map(([column]) => identifier(column)).join(',')}) VALUES (${entries.map(() => '?').join(',')})`,
          entries.map(([, value]) => value),
        );
      }
    }
    const [folios] = await connection.query<RowDataPacket[]>(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(folio,5) AS UNSIGNED)),0) AS maximum FROM receta WHERE folio REGEXP '^REC-[0-9]+$'",
    );
    await connection.query(
      "UPDATE id_counter SET siguiente=GREATEST(siguiente,104,?) WHERE nombre='receta_folio'",
      [Number(folios[0]?.maximum) + 1],
    );
    await connection.commit();
    // DDL cannot share the clinical bootstrap transaction. Explicit WRITE locks keep
    // other allocators out while inspecting the current high-water mark and raising it.
    const sequences = [
      'profesional',
      'paciente',
      'expediente',
      'responsable',
      'consulta',
      'diagnostico',
      'tratamiento',
      'receta',
    ];
    for (const table of sequences) {
      await connection.query(`LOCK TABLES ${identifier(table)} WRITE`);
      try {
        const [metadata] = await connection.query<RowDataPacket[]>(
          'SELECT AUTO_INCREMENT AS next FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',
          [table],
        );
        const [maximum] = await connection.query<RowDataPacket[]>(
          `SELECT COALESCE(MAX(${identifier(`id_${table}`)}),0) AS maximum FROM ${identifier(table)}`,
        );
        const next = Math.max(104, Number(metadata[0]?.next ?? 1), Number(maximum[0]?.maximum) + 1);
        if (!Number.isSafeInteger(next) || next > 2147483647)
          throw new Error('Seed counter exhausted');
        if (Number(metadata[0]?.next ?? 1) < next)
          await connection.query(`ALTER TABLE ${identifier(table)} AUTO_INCREMENT = ${next}`);
      } finally {
        await connection.query('UNLOCK TABLES');
      }
    }
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    await connection.query("SELECT RELEASE_LOCK('genki_demo_seed')").catch(() => undefined);
    await connection.end();
  }
}
