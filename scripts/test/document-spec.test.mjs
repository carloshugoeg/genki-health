import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const CONTRACT = 'docs/plan/contracts/DOCUMENTS-SECURITY.md';
const MONGO_SCHEMA = 'docs/plan/contracts/mongodb-schema.json';
const ADR3 = 'docs/specs/adr/ADR-0003-mongodb-aggregates.md';
const ADR4 = 'docs/specs/adr/ADR-0004-firestore-aggregates.md';
const ADR5 = 'docs/specs/adr/ADR-0005-security-and-transactions.md';
const ADR_INDEX = 'docs/specs/adr/INDEX.md';

function read(rel) {
  const path = join(root, rel);
  assert.ok(existsSync(path), `${rel} must exist`);
  return readFileSync(path, 'utf8');
}

test('histories_are_referenced_not_unbounded_embeds', () => {
  const contract = read(CONTRACT);
  const schema = JSON.parse(read(MONGO_SCHEMA));
  const adr3 = read(ADR3);
  const adr4 = read(ADR4);
  const index = read(ADR_INDEX);

  assert.match(
    contract,
    /consultations never embed into patient or expediente because history is unbounded/i,
    'DOCUMENTS-SECURITY.md must keep patient/expediente histories referenced, not unbounded embeds',
  );
  assert.match(
    contract,
    /bounded diagnosis\/treatment\/prescription details embed inside a consultation/i,
    'DOCUMENTS-SECURITY.md must embed bounded clinical details inside consultation',
  );
  assert.ok(
    schema.consultas?.$jsonSchema?.properties?.diagnosticos,
    'mongodb-schema.json must embed diagnosticos on consultas',
  );
  assert.ok(
    schema.consultas?.$jsonSchema?.properties?.tratamientos,
    'mongodb-schema.json must embed tratamientos on consultas',
  );
  assert.equal(
    schema.pacientes?.$jsonSchema?.properties?.consultas,
    undefined,
    'mongodb-schema.json must not embed consultas on pacientes',
  );
  assert.equal(
    schema.expedientes?.$jsonSchema?.properties?.consultas,
    undefined,
    'mongodb-schema.json must not embed consultas on expedientes',
  );
  assert.match(
    adr3,
    /integer|numeric surrogate|integer keys/i,
    'ADR-0003 must record integer document ids',
  );
  assert.match(
    adr3,
    /unbounded|history|reference/i,
    'ADR-0003 must record embed versus reference for unbounded history',
  );
  assert.match(
    adr4,
    /read-before-write|documentKeys|reservation/i,
    'ADR-0004 must record Firestore read-before-write uniqueness',
  );
  assert.match(index, /ADR-0003/, 'ADR INDEX must link ADR-0003');
  assert.match(index, /ADR-0004/, 'ADR INDEX must link ADR-0004');
});

test('admin_rules_bypass_is_documented', () => {
  const contract = read(CONTRACT);
  const adr4 = read(ADR4);
  const adr5 = read(ADR5);
  const index = read(ADR_INDEX);

  assert.match(
    contract,
    /Backend Firebase Admin bypasses rules even in emulator/i,
    'DOCUMENTS-SECURITY.md must document Admin rules bypass',
  );
  assert.match(
    contract,
    /Do not claim these rules secure Admin/i,
    'DOCUMENTS-SECURITY.md must state rules do not secure Admin',
  );
  assert.match(
    adr4,
    /Admin bypass|does not secure Admin|bypass/i,
    'ADR-0004 must record the Admin bypass limitation',
  );
  assert.match(
    adr5,
    /classification|roles|genki_app|genki_identity|genki_report/i,
    'ADR-0005 must document classification and separate principals',
  );
  assert.doesNotMatch(
    adr5,
    /encryption-at-rest (is|was) implemented|we implemented (field-level )?encryption/i,
    'ADR-0005 must not claim encryption was implemented',
  );
  assert.match(index, /ADR-0005/, 'ADR INDEX must link ADR-0005');
});

test('seed_password_is_env_only', () => {
  const contract = read(CONTRACT);
  const adr5 = read(ADR5);

  assert.match(
    contract,
    /SEED_PASSWORD/,
    'DOCUMENTS-SECURITY.md must name SEED_PASSWORD as an environment variable',
  );
  assert.match(
    contract,
    /Environment NAMES, no sample values/i,
    'DOCUMENTS-SECURITY.md must forbid sample secret values',
  );
  assert.match(
    contract,
    /\.env\.example.*empty values|lists these names with empty values/i,
    'DOCUMENTS-SECURITY.md must require empty .env.example secret values',
  );
  assert.match(
    contract,
    /Patients 101\/102\/103 per institution/i,
    'DOCUMENTS-SECURITY.md must include the seed fixture matrix patient ids',
  );
  assert.match(
    contract,
    /demo-<institutionId>-<role>@example\.invalid/,
    'DOCUMENTS-SECURITY.md must specify synthetic demo emails',
  );
  assert.doesNotMatch(
    contract,
    /SEED_PASSWORD\s*=\s*['"][^'"]+['"]/,
    'DOCUMENTS-SECURITY.md must not embed a SEED_PASSWORD literal value',
  );
  assert.match(
    adr5,
    /SEED_PASSWORD|env-only|environment/i,
    'ADR-0005 must keep seed passwords env-only',
  );
});
