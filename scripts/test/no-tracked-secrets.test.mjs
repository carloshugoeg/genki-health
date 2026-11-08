import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const selfRel = relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/');

const FORBIDDEN_FINGERPRINTS = [
  'GenkiDev1',
  'test-secret-at-least-16',
  'genki-dev-jwt-secret-change-me',
  'genki_dev_only',
];

const ENV_SECRET_KEYS =
  /^(?:JWT_SECRET|SEED_PASSWORD|POSTGRES_PASSWORD|MYSQL_ROOT_PASSWORD|MYSQL_PASSWORD|MONGO_ROOT_PASSWORD|MONGO_APP_PASSWORD|MONGO_REPORT_PASSWORD|APP_DB_PASSWORD|IDENTITY_DB_PASSWORD|REPORT_DB_PASSWORD)=(.*)$/gm;

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'buffer' });
  return out
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((rel) => {
      if (rel === selfRel) return false;
      if (rel.startsWith('poteto-mode/queue/tickets/')) return false;
      if (rel.startsWith('docs/progress/journal/')) return false;
      return (
        rel.startsWith('server/src/') ||
        rel.startsWith('web/src/') ||
        rel.startsWith('shared/src/') ||
        rel === '.env.example' ||
        rel === 'README.md'
      );
    });
}

test('retired_credential_needles_are_sha256_fingerprints', () => {
  assert.equal(FORBIDDEN_FINGERPRINTS.length, 4, 'must retain coverage for all 4 retired credentials');
  for (const fp of FORBIDDEN_FINGERPRINTS) {
    assert.match(
      fp,
      /^[a-f0-9]{64}$/,
      'retired credential needles must be sha256 hex fingerprints, not plaintext',
    );
  }
});

test('schema_sample_password_uses_node_crypto', () => {
  const src = read('server/src/adapters/http/schemas.test.ts');
  assert.match(src, /from ['"]node:crypto['"]/, 'schemas.test.ts must import node:crypto');
  assert.match(src, /randomBytes/, 'schemas.test.ts must generate sample password with randomBytes');
  assert.doesNotMatch(
    src,
    /sampleLoginPassword\s*=\s*'[^']*'/,
    'sampleLoginPassword must not be a fixed string literal',
  );
});

test('no_tracked_credential_literals', () => {
  const hits = [];
  for (const rel of trackedFiles()) {
    const text = read(rel);
    for (const needle of FORBIDDEN_FINGERPRINTS) {
      if (text.includes(needle)) {
        hits.push(`${rel}: forbidden substring ${needle}`);
      }
    }
    if (rel === '.env.example') {
      for (const match of text.matchAll(ENV_SECRET_KEYS)) {
        const value = match[1].trim();
        if (value.length > 0) {
          hits.push(`${rel}: secret env key must be empty, found ${match[0].split('=')[0]}=…`);
        }
      }
    }
  }
  assert.equal(hits.length, 0, `tracked credential literals:\n${hits.join('\n')}`);
});

test('no_tracked_demo_password_constant', () => {
  const auth = read('server/src/adapters/memory/auth.ts');
  assert.doesNotMatch(
    auth,
    /\bDEMO_PASSWORD\b/,
    'memory auth must not define or reference DEMO_PASSWORD',
  );
});

test('no_memory_auth_adapter_export_or_alias', () => {
  const auth = read('server/src/adapters/memory/auth.ts');
  const index = read('server/src/adapters/memory/index.ts');
  assert.doesNotMatch(
    auth,
    /MemoryAuthAdapter/,
    'memory/auth.ts must not export or alias MemoryAuthAdapter',
  );
  assert.doesNotMatch(
    index,
    /MemoryAuthAdapter/,
    'memory/index.ts must not re-export MemoryAuthAdapter',
  );

  const hits = [];
  for (const rel of trackedFiles()) {
    if (!rel.startsWith('server/src/')) continue;
    const text = read(rel);
    if (text.includes('MemoryAuthAdapter')) {
      hits.push(rel);
    }
  }
  assert.equal(
    hits.length,
    0,
    `MemoryAuthAdapter must not appear under server/src:\n${hits.join('\n')}`,
  );
});

test('callers_use_memory_identity_store', () => {
  const compose = read('server/src/config/compose-memory.ts');
  const authTest = read('server/src/ports/auth.test.ts');
  const memoryAuth = read('server/src/adapters/memory/auth.ts');

  assert.match(memoryAuth, /export class MemoryIdentityStore/, 'MemoryIdentityStore must exist');
  assert.match(compose, /MemoryIdentityStore/, 'compose-memory must wire MemoryIdentityStore');
  assert.doesNotMatch(
    compose,
    /MemoryAuthAdapter|new\s+MemoryAuth\b/,
    'compose-memory must not construct MemoryAuthAdapter',
  );
  assert.match(authTest, /MemoryIdentityStore/, 'auth tests must use MemoryIdentityStore');
  assert.doesNotMatch(
    authTest,
    /MemoryAuthAdapter/,
    'auth tests must not reference MemoryAuthAdapter',
  );
});
