import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const selfRel = relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/');

const FORBIDDEN_FINGERPRINTS = [
  'f284481bd69b80e27a7d660f7a25727712adbe2e6a9301603c91ff41ebc205b2',
  'd71cc132ca6e90deabcb50e2cc52f47fb8ed4349146c78789d7e0bfb57717632',
  '1abe58a23a17a5d8f382ae69063ff945190659228fec6972775e7d7ae3ed4695',
  '4970b80ca41e8781b9c041c0cf031833c851c9ad2bf55db9698dc95a3f925683',
];

const FORBIDDEN_FINGERPRINT_SET = new Set(FORBIDDEN_FINGERPRINTS);

const ENV_SECRET_KEYS =
  /^(?:JWT_SECRET|SEED_PASSWORD|POSTGRES_PASSWORD|MYSQL_ROOT_PASSWORD|MYSQL_PASSWORD|MONGO_ROOT_PASSWORD|MONGO_APP_PASSWORD|MONGO_REPORT_PASSWORD|APP_DB_PASSWORD|IDENTITY_DB_PASSWORD|REPORT_DB_PASSWORD)=(.*)$/gm;

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fingerprint(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function credentialCandidates(text) {
  const out = new Set();
  for (const match of text.matchAll(/[A-Za-z0-9_./+-]+/g)) {
    if (match[0].length >= 8) out.add(match[0]);
  }
  return out;
}

function findRetiredFingerprintHits(text) {
  const hits = [];
  for (const candidate of credentialCandidates(text)) {
    const fp = fingerprint(candidate);
    if (FORBIDDEN_FINGERPRINT_SET.has(fp)) {
      hits.push(fp);
    }
  }
  return hits;
}

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'buffer' });
  return out
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((rel) => {
      if (rel === selfRel) return false;
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
  assert.equal(
    FORBIDDEN_FINGERPRINTS.length,
    4,
    'must retain coverage for all 4 retired credentials',
  );
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
  assert.match(
    src,
    /randomBytes/,
    'schemas.test.ts must generate sample password with randomBytes',
  );
  assert.doesNotMatch(
    src,
    /sampleLoginPassword\s*=\s*'[^']*'/,
    'sampleLoginPassword must not be a fixed string literal',
  );
});

test('fingerprint_matcher_detects_all_four_retired_credentials', () => {
  const synthetic = `Aa1${randomBytes(12).toString('hex')}`;
  const syntheticFp = fingerprint(synthetic);
  assert.equal(
    findRetiredFingerprintHits(`password=${synthetic}\n`).length,
    0,
    'unrelated runtime secret must not match retired fingerprints',
  );

  const planted = execFileSync('git', ['show', '24e40b9:server/src/ports/auth.test.ts'], {
    cwd: root,
    encoding: 'utf8',
  });
  const envPlanted = execFileSync('git', ['show', '24e40b9:.env.example'], {
    cwd: root,
    encoding: 'utf8',
  });
  const hits = new Set(findRetiredFingerprintHits(`${planted}\n${envPlanted}`));
  for (const fp of FORBIDDEN_FINGERPRINTS) {
    assert.ok(hits.has(fp), `retired fingerprint ${fp} must still be detected`);
  }
  assert.equal(hits.size, 4, 'all 4 retired credentials must be detected');
  assert.ok(!hits.has(syntheticFp), 'synthetic runtime value must stay out of retired hits');
});

test('no_tracked_credential_literals', () => {
  const hits = [];
  for (const rel of trackedFiles()) {
    const text = read(rel);
    for (const fp of findRetiredFingerprintHits(text)) {
      hits.push(`${rel}: forbidden credential fingerprint ${fp}`);
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
  const identityAdmin = read('server/src/adapters/memory/identity-admin.ts');

  assert.match(memoryAuth, /export class MemoryIdentityStore/, 'MemoryIdentityStore must exist');
  assert.match(
    identityAdmin,
    /MemoryIdentityStore/,
    'memory identity admin (used by compose-memory) must wire MemoryIdentityStore',
  );
  assert.match(compose, /createMemoryIdentityAdmin/, 'compose-memory must use the identity admin');
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
