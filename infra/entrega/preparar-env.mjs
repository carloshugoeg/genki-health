#!/usr/bin/env node
// Prepara `.env` para la entrega y lo imprime como `export` para que levantar.sh lo cargue.
//  - Si `.env` no existe, lo crea desde `.env.example` con secretos aleatorios locales
//    (SEED_PASSWORD = admin123!, la contraseña de los usuarios demo) y modo 0600.
//  - Si existe pero no es de la entrega (falta GENKI_ENTREGA=1), se detiene sin tocarlo.
//  - En cada ejecución recalcula las URL derivadas (puertos/contraseñas → DSN).
// Nunca escribe valores secretos en la terminal: stdout solo lo consume `eval` en levantar.sh.
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENV = join(ROOT, '.env');
const EXAMPLE = join(ROOT, '.env.example');
const DEMO_PASSWORD = 'admin123!';
const SECRETS = [
  'JWT_SECRET',
  'POSTGRES_PASSWORD',
  'MYSQL_ROOT_PASSWORD',
  'MYSQL_PASSWORD',
  'MONGO_ROOT_PASSWORD',
  'MONGO_APP_PASSWORD',
  'MONGO_REPORT_PASSWORD',
  'APP_DB_PASSWORD',
  'IDENTITY_DB_PASSWORD',
  'REPORT_DB_PASSWORD',
];
// Puertos que se pueden fijar al crear .env, p. ej. `POSTGRES_PORT=6543 bash levantar.sh`.
const PORTS = [
  'API_PORT',
  'WEB_PORT',
  'POSTGRES_PORT',
  'MYSQL_PORT',
  'MONGO_PORT',
  'FIRESTORE_PORT',
];

function fail(message) {
  process.stderr.write(`\nERROR: ${message}\n`);
  process.exit(1);
}

function parse(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

/** Reemplaza el valor de cada clave en su línea, conservando comentarios y orden. */
function render(text, values) {
  const seen = new Set();
  const lines = text.split(/\r?\n/).map((line) => {
    const match = /^([A-Z0-9_]+)=/.exec(line);
    if (!match || !values.has(match[1])) return line;
    seen.add(match[1]);
    return `${match[1]}=${values.get(match[1])}`;
  });
  for (const [key, value] of values) if (!seen.has(key)) lines.push(`${key}=${value}`);
  return lines.join('\n').replace(/\n*$/, '\n');
}

if (!existsSync(EXAMPLE)) fail('No se encontró .env.example en la raíz del repositorio.');

let text;
let values;
if (existsSync(ENV)) {
  text = readFileSync(ENV, 'utf8');
  values = parse(text);
  if (values.get('GENKI_ENTREGA') !== '1')
    fail(
      'Ya existe un .env que no fue creado por levantar.sh (le falta GENKI_ENTREGA=1).\n' +
        '       Para no tocar tu configuración, levantar.sh no lo usa. Respáldalo y vuelve a intentar:\n' +
        '         mv .env .env.respaldo && bash levantar.sh',
    );
} else {
  text = readFileSync(EXAMPLE, 'utf8');
  values = parse(text);
  // Hex: seguro dentro de URLs y de la shell, sin necesidad de escapar.
  for (const key of SECRETS) if (!values.get(key)) values.set(key, randomBytes(24).toString('hex'));
  values.set('SEED_PASSWORD', DEMO_PASSWORD);
  for (const key of PORTS) {
    const override = process.env[key];
    if (override && /^[0-9]+$/.test(override)) values.set(key, override);
  }
  process.stderr.write('    .env creado con contraseñas locales aleatorias (no se muestran).\n');
}

const v = (key) => {
  const value = values.get(key);
  if (!value)
    fail(
      `Falta ${key} en .env. Borra .env (y los datos con: bash detener.sh --borrar-datos) y vuelve a ejecutar levantar.sh.`,
    );
  return value;
};
for (const key of PORTS) if (!/^[0-9]+$/.test(v(key))) fail(`${key} debe ser un número de puerto.`);

const host = '127.0.0.1';
const pg = `${host}:${v('POSTGRES_PORT')}/${v('POSTGRES_DB')}`;
const my = `${host}:${v('MYSQL_PORT')}/${v('MYSQL_DATABASE')}`;
const mongo = `${host}:${v('MONGO_PORT')}/${v('MONGO_DATABASE')}`;
const mongoAdmin = `mongodb://root:${v('MONGO_ROOT_PASSWORD')}@${mongo}?authSource=admin&replicaSet=rs0&directConnection=true`;
const derived = {
  FIRESTORE_EMULATOR_HOST: `${host}:${v('FIRESTORE_PORT')}`,
  // Dueños (DDL, GRANT y seeds).
  PG_ADMIN_URL: `postgres://genki:${v('POSTGRES_PASSWORD')}@${pg}`,
  MYSQL_ADMIN_URL: `mysql://root:${v('MYSQL_ROOT_PASSWORD')}@${my}`,
  MONGO_ADMIN_URI: mongoAdmin,
  // Logins de mínimo privilegio que usa la API (GENKI_MODE=engines).
  DATABASE_URL: `postgres://genki_app_login:${v('APP_DB_PASSWORD')}@${pg}`,
  AUTH_DATABASE_URL: `postgres://genki_identity_login:${v('IDENTITY_DB_PASSWORD')}@${pg}`,
  MYSQL_URL: `mysql://genki_app_login:${v('APP_DB_PASSWORD')}@${my}`,
  MONGODB_URI: `mongodb://genkiApp:${v('MONGO_APP_PASSWORD')}@${mongo}?authSource=${v('MONGO_DATABASE')}&replicaSet=rs0&directConnection=true`,
  // Módulo de agenda (migración/seed con el dueño).
  AGENDA_POSTGRES_URL: `postgres://genki:${v('POSTGRES_PASSWORD')}@${pg}`,
  AGENDA_MYSQL_URL: `mysql://root:${v('MYSQL_ROOT_PASSWORD')}@${my}`,
  AGENDA_MONGODB_URL: mongoAdmin,
};
for (const [key, value] of Object.entries(derived)) values.set(key, value);
v('SEED_PASSWORD');
if (values.get('FIRESTORE_MODE') !== 'emulator')
  fail('Este .env no usa FIRESTORE_MODE=emulator; la entrega solo corre con el emulador local.');

const next = render(text, values);
if (!existsSync(ENV) || readFileSync(ENV, 'utf8') !== next)
  writeFileSync(ENV, next, { mode: 0o600 });
chmodSync(ENV, 0o600);

// Salida para `eval` en levantar.sh: comillas simples para que &, ? y ! no se interpreten.
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
for (const [key, value] of values) {
  process.stdout.write(value === '' ? `unset ${key}\n` : `export ${key}=${quote(value)}\n`);
}
