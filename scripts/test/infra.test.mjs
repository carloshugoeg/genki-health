import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel) {
  const path = join(root, rel);
  assert.ok(existsSync(path), `${rel} must exist`);
  return readFileSync(path, 'utf8');
}

test('compose_uses_loopback_and_env_secrets', () => {
  const compose = read('infra/entrega/docker-compose.yml');

  assert.match(
    compose,
    /127\.0\.0\.1:\$\{[A-Z_]+:-\d+\}:5432/,
    'postgres must publish only on loopback 127.0.0.1',
  );
  assert.match(
    compose,
    /127\.0\.0\.1:\$\{[A-Z_]+:-\d+\}:3306/,
    'mysql must publish only on loopback 127.0.0.1',
  );
  assert.match(
    compose,
    /127\.0\.0\.1:\$\{[A-Z_]+:-\d+\}:27017/,
    'mongodb must publish only on loopback 127.0.0.1',
  );
  assert.doesNotMatch(
    compose,
    /^\s*-\s*['"]?\d+:\d+['"]?\s*$/m,
    'compose must not publish bare host ports outside 127.0.0.1',
  );

  assert.match(
    compose,
    /POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD\}/,
    'postgres password must expand from POSTGRES_PASSWORD env',
  );
  assert.match(
    compose,
    /MYSQL_PASSWORD:\s*\$\{MYSQL_PASSWORD\}/,
    'mysql password must expand from MYSQL_PASSWORD env',
  );
  assert.match(
    compose,
    /MYSQL_ROOT_PASSWORD:\s*\$\{MYSQL_ROOT_PASSWORD\}/,
    'mysql root password must expand from MYSQL_ROOT_PASSWORD env',
  );
  assert.match(
    compose,
    /MONGO_ROOT_PASSWORD:\s*\$\{MONGO_ROOT_PASSWORD\}/,
    'mongo root password must expand from MONGO_ROOT_PASSWORD env',
  );
  assert.doesNotMatch(
    compose,
    /genki_dev_only|genki_root_dev_only/,
    'compose must not embed hardcoded local password literals',
  );

  assert.match(compose, /postgres:/, 'compose must define postgres');
  assert.match(compose, /mysql:/, 'compose must define mysql');
  assert.match(compose, /mongodb:/, 'compose must define mongodb');
  assert.match(compose, /healthcheck:/, 'compose services must declare healthchecks');
});

test('mongo_is_authenticated_rs0', () => {
  const compose = read('infra/entrega/docker-compose.yml');
  const startRs = read('infra/mongodb/start-rs.sh');

  assert.match(compose, /start-rs\.sh/, 'mongodb service must run infra/mongodb/start-rs.sh');
  assert.match(
    compose,
    /replSet|rs0|keyFile|keyfile|MONGO_ROOT_PASSWORD/i,
    'mongodb service must require auth/rs0/keyfile wiring',
  );
  assert.match(startRs, /\brs0\b/, 'start-rs.sh must name replica set rs0');
  assert.match(
    startRs,
    /key[Ff]ile|KEYFILE/,
    'start-rs.sh must generate or use a keyfile inside the container',
  );
  assert.match(startRs, /chmod\s+0?600|chmod\s+600/, 'start-rs.sh must set keyfile mode 0600');
  assert.match(startRs, /rs\.initiate|replSet/, 'start-rs.sh must initialize the replica set');
  assert.match(
    startRs,
    /isMaster|hello|primary|ismaster/i,
    'start-rs.sh must wait for primary before considering readiness',
  );
  assert.match(startRs, /--auth|createUser/, 'start-rs.sh must enable authentication');

  assert.equal(
    existsSync(join(root, 'infra/mongodb/mongo-keyfile')),
    false,
    'mongo keyfile must not be committed under infra/mongodb',
  );
  assert.equal(
    existsSync(join(root, 'infra/mongodb/keyfile')),
    false,
    'mongo keyfile must not be committed under infra/mongodb',
  );
});

test('reset_rejects_non_test_database', async () => {
  const migratePath = join(root, 'scripts/db-migrate.ts');
  assert.ok(existsSync(migratePath), 'scripts/db-migrate.ts must exist');

  const mod = await import(`${pathToFileURL(migratePath).href}?t=${Date.now()}`);
  assert.equal(
    typeof mod.resetTestDatabase,
    'function',
    'db-migrate.ts must export resetTestDatabase',
  );

  await assert.rejects(
    () => mod.resetTestDatabase('genki_hospital'),
    /genki_test_/,
    'reset must reject non-prefixed clinical database names',
  );
  await assert.rejects(
    () => mod.resetTestDatabase('production'),
    /genki_test_/,
    'reset must reject arbitrary non-test names',
  );
});
