/** npx tsx server/test/full/procedure/manage.ts migrate|seed [postgres] */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const [command, engine = 'postgres'] = process.argv.slice(2);
if (!['migrate', 'seed'].includes(command ?? '') || engine !== 'postgres') {
  throw new Error('Uso: manage.ts migrate|seed [postgres]');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const sql = await readFile(
    fileURLToPath(
      new URL('../../../src/adapters/postgres/full/procedure/migrations/001.sql', import.meta.url),
    ),
    'utf8',
  );
  await pool.query(sql);
  console.log(`postgres: ${command} OK`);
} finally {
  await pool.end();
}
