import pg from 'pg';
import * as argon2 from 'argon2';
import { validatePasswordPolicy } from '@genki/shared';

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
  'rol',
]);
const sequences = [
  'profesional',
  'paciente',
  'expediente',
  'responsable',
  'consulta',
  'diagnostico',
  'tratamiento',
  'receta',
  'usuario',
];
function identifier(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid seed identifier');
  return `"${name}"`;
}

/** Owner-only, disposable bootstrap. Never called by a clinical route or API startup. */
export async function seedPostgres(url: string, rows: SeedRow[], password: string): Promise<void> {
  const target = new URL(url);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !/^\/genki_test_[a-z0-9_]+$/.test(target.pathname)
  )
    throw new Error('Postgres seed requires a loopback disposable genki_test_ database');
  if (validatePasswordPolicy(password)) throw new Error('SEED_PASSWORD violates password_policy');
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    // Locks prevent concurrent INSERT/default nextval allocations while reserving fixture IDs.
    await client.query(
      `LOCK TABLE ${[...tables, 'usuario', 'id_counter', 'consulta', 'diagnostico', 'tratamiento', 'receta'].map(identifier).join(',')} IN SHARE ROW EXCLUSIVE MODE`,
    );
    for (const { table, key, data, preserve = [] } of rows) {
      if (!tables.has(table)) throw new Error('Invalid seed table');
      const found = await client.query(
        `SELECT 1 FROM ${identifier(table)} WHERE ${identifier(key)} = $1`,
        [data[key]],
      );
      const entries = Object.entries(data);
      if (found.rowCount) {
        const expected = entries.filter(([column]) => !preserve.includes(column));
        const matches = await client.query(
          `SELECT 1 FROM ${identifier(table)} WHERE ${expected.map(([column], i) => `${identifier(column)} IS NOT DISTINCT FROM $${i + 1}`).join(' AND ')}`,
          expected.map(([, value]) => value),
        );
        if (!matches.rowCount) throw new Error(`Seed fixture conflict in ${table}`);
      } else {
        await client.query(
          `INSERT INTO ${identifier(table)} (${entries.map(([column]) => identifier(column)).join(',')}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(',')})`,
          entries.map(([, value]) => value),
        );
      }
    }
    for (const table of sequences) {
      const column = `id_${table}`;
      const result = await client.query<{ seq: string }>(
        'SELECT pg_get_serial_sequence($1,$2) AS seq',
        [table, column],
      );
      const seq = result.rows[0]!.seq;
      // pg_sequences.last_value can be NULL for an unused sequence; relation last_value cannot.
      const parts = seq.split('.').map(identifier).join('.');
      await client.query(
        `SELECT setval($1::regclass,GREATEST((SELECT last_value FROM ${parts}),(SELECT COALESCE(MAX(${identifier(column)}),0) FROM ${identifier(table)}),103),true)`,
        [seq],
      );
    }
    // Clinical attribution comes from usuario.id_profesional. The FK references the Hospital PG
    // `profesional` table, so PG id 1 (institution 1, always seeded) satisfies it; for
    // institutions 2-4 the same id denotes professional 1 of that institution's own engine
    // catalog (MySQL `profesional`, Mongo `profesionales`, Firestore `professionals`), which
    // scripts/seed.ts seeds active in every engine. Only NULL links are filled; an existing
    // link (e.g. set through the users API) is preserved.
    const DEMO_PROFESIONAL_ID = 1;
    const linkProfesional = async (correo: string): Promise<void> => {
      await client.query(
        'UPDATE usuario SET id_profesional=$1 WHERE correo=$2 AND id_profesional IS NULL',
        [DEMO_PROFESIONAL_ID, correo],
      );
    };
    const roles = ['administrador', 'recepcion', 'medico', 'auditor'];
    for (let institution = 1; institution <= 4; institution++) {
      for (const [index, role] of roles.entries()) {
        const correo = `demo-${institution}-${role}@example.invalid`;
        const user = await client.query(
          'SELECT id_institucion,id_rol,nombre_usuario,hash_contrasena,estado FROM usuario WHERE correo=$1',
          [correo],
        );
        const username = `demo-${institution}-${role}`;
        if (user.rowCount) {
          const current = user.rows[0];
          if (
            current.id_institucion !== institution ||
            current.id_rol !== index + 1 ||
            current.nombre_usuario !== username
          )
            throw new Error('Seed identity fixture conflict');
          if (
            current.estado !== 'activo' ||
            !String(current.hash_contrasena).startsWith('$argon2id$')
          )
            throw new Error(
              'Seed existing identity is inactive or lacks Argon2id; preserved without reset',
            );
          if (role === 'medico') await linkProfesional(correo);
          continue; // Never rehash or reset an existing identity.
        }
        const hash = await argon2.hash(password, { type: argon2.argon2id });
        await client.query(
          "INSERT INTO usuario (id_institucion,id_rol,nombre_usuario,correo,hash_contrasena,estado) VALUES ($1,$2,$3,$4,$5,'activo')",
          [institution, index + 1, username, correo, hash],
        );
        if (role === 'medico') await linkProfesional(correo);
      }
    }
    // Grading superadmin: Hospital PG identity only; password from SEED_PASSWORD.
    const superRole = await client.query(
      "SELECT id_rol,nombre FROM rol WHERE id_rol=5 OR nombre='superadministrador'",
    );
    if (superRole.rowCount) {
      const row = superRole.rows[0];
      if (row.id_rol !== 5 || row.nombre !== 'superadministrador')
        throw new Error('Seed superadministrador role conflict');
    } else {
      await client.query(
        "INSERT INTO rol (id_rol,nombre,descripcion) VALUES (5,'superadministrador',$1)",
        ['Contenido académico simulado; no usar para atención'],
      );
    }
    const superCorreo = 'superadmin@example.invalid';
    const superUser = await client.query(
      'SELECT id_institucion,id_rol,nombre_usuario,hash_contrasena,estado FROM usuario WHERE correo=$1',
      [superCorreo],
    );
    if (superUser.rowCount) {
      const current = superUser.rows[0];
      if (
        current.id_institucion !== 1 ||
        current.id_rol !== 5 ||
        current.nombre_usuario !== 'superadmin'
      )
        throw new Error('Seed superadmin identity fixture conflict');
      if (current.estado !== 'activo' || !String(current.hash_contrasena).startsWith('$argon2id$'))
        throw new Error(
          'Seed existing identity is inactive or lacks Argon2id; preserved without reset',
        );
    } else {
      const hash = await argon2.hash(password, { type: argon2.argon2id });
      await client.query(
        "INSERT INTO usuario (id_institucion,id_rol,nombre_usuario,correo,hash_contrasena,estado) VALUES (1,5,'superadmin',$1,$2,'activo')",
        [superCorreo, hash],
      );
    }
    // Remaining Entrega I ROL catalog values (§ROL.nombre: recepcion, enfermeria, medico,
    // laboratorista, odontologo, administrador). Matched by unique name; never renumbered.
    for (const nombre of ['enfermeria', 'laboratorista', 'odontologo']) {
      const found = await client.query('SELECT id_rol FROM rol WHERE nombre=$1', [nombre]);
      if (found.rowCount) continue;
      await client.query(
        'INSERT INTO rol (id_rol,nombre,descripcion) SELECT GREATEST(COALESCE(MAX(id_rol),0),5)+1,$1,$2 FROM rol',
        [nombre, 'Contenido académico simulado; no usar para atención'],
      );
    }
    // Dental demo identity: Clínica odontológica (institution 4) gates OP-55..60 on `odontologo`.
    // Linked to professional 1 of the Firestore catalog (see linkProfesional above).
    const dentalCorreo = 'demo-4-odontologo@example.invalid';
    const dentalRole = await client.query<{ id_rol: number }>(
      "SELECT id_rol FROM rol WHERE nombre='odontologo'",
    );
    const dentalRoleId = dentalRole.rows[0]!.id_rol;
    const dentalUser = await client.query(
      'SELECT id_institucion,id_rol,nombre_usuario,hash_contrasena,estado FROM usuario WHERE correo=$1',
      [dentalCorreo],
    );
    if (dentalUser.rowCount) {
      const current = dentalUser.rows[0];
      if (
        current.id_institucion !== 4 ||
        current.id_rol !== dentalRoleId ||
        current.nombre_usuario !== 'demo-4-odontologo'
      )
        throw new Error('Seed dental identity fixture conflict');
      if (current.estado !== 'activo' || !String(current.hash_contrasena).startsWith('$argon2id$'))
        throw new Error(
          'Seed existing identity is inactive or lacks Argon2id; preserved without reset',
        );
    } else {
      const hash = await argon2.hash(password, { type: argon2.argon2id });
      await client.query(
        "INSERT INTO usuario (id_institucion,id_rol,nombre_usuario,correo,hash_contrasena,estado) VALUES (4,$1,'demo-4-odontologo',$2,$3,'activo')",
        [dentalRoleId, dentalCorreo, hash],
      );
    }
    await linkProfesional(dentalCorreo);
    const folios = await client.query<{ maximum: number }>(
      "SELECT COALESCE(MAX(substring(folio from '^REC-([0-9]+)$')::bigint),0)::int AS maximum FROM receta",
    );
    await client.query(
      "UPDATE id_counter SET siguiente=GREATEST(siguiente,104,$1) WHERE nombre='receta_folio'",
      [folios.rows[0]!.maximum + 1],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

/** One seed command at a time across all stores; releasing this owner session releases the lock. */
export async function lockSeed(url: string): Promise<() => Promise<void>> {
  const target = new URL(url);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !/^\/genki_test_[a-z0-9_]+$/.test(target.pathname)
  )
    throw new Error('Seed requires a loopback disposable genki_test_ database');
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const result = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock(51001,1) AS locked',
    );
    if (!result.rows[0]?.locked) throw new Error('Seed already running');
    return () => client.end();
  } catch (error) {
    await client.end();
    throw error;
  }
}
