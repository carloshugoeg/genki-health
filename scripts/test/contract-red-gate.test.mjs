import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function jobBody(ci, jobName) {
  const re = new RegExp(
    `^  ${jobName}:\\s*\\n([\\s\\S]*?)(?=\\n  [a-zA-Z0-9_-]+:\\s*\\n|(?![\\s\\S]))`,
    'm',
  );
  const match = ci.match(re);
  assert.ok(match, `ci.yml must declare a ${jobName} job`);
  return match[1];
}

test('expect_contract_red_script_exists', () => {
  const path = join(root, 'scripts/expect-contract-red.sh');
  assert.ok(
    existsSync(path),
    'scripts/expect-contract-red.sh must exist so CONTRACT_RED failures report as expected-red',
  );
});

test('package_json_exposes_test_contract_red', () => {
  const pkg = JSON.parse(read('package.json'));
  const scripts = pkg.scripts ?? {};
  const contractRed = Object.entries(scripts).find(([, cmd]) =>
    String(cmd).includes('expect-contract-red.sh'),
  );
  assert.ok(
    contractRed,
    'package.json must define a script (e.g. test:contract-red) that runs scripts/expect-contract-red.sh',
  );
});

test('ci_has_separate_contract_red_job', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(
    ci,
    /^  contract-red:/m,
    'ci.yml must declare a contract-red job separate from validate',
  );
  const body = jobBody(ci, 'contract-red');
  assert.match(
    body,
    /expect-contract-red\.sh|test:contract-red/,
    'contract-red job steps must run the expect script',
  );
});

test('validate_tests_step_stays_plain_npm_test', () => {
  const ci = read('.github/workflows/ci.yml');
  const validateBody = jobBody(ci, 'validate');
  assert.match(
    validateBody,
    /name:\s*Tests[\s\S]*?run:\s*npm test\b/,
    'validate job Tests step must remain plain npm test',
  );
  assert.doesNotMatch(
    validateBody,
    /CONTRACT_RED\s*=\s*1/,
    'validate job must not set CONTRACT_RED=1',
  );
});

test('vitest_keeps_contract_discovery_gate', () => {
  const config = read('server/vitest.config.ts');
  assert.match(
    config,
    /CONTRACT_RED\s*===\s*['"]1['"]/,
    'server/vitest.config.ts must read CONTRACT_RED=1',
  );
  assert.match(
    config,
    /CONTRACT_READY\s*===\s*['"]1['"]/,
    'server/vitest.config.ts must read CONTRACT_READY=1',
  );
  assert.match(
    config,
    /exclude\.push\(\s*['"]test\/contracts\/\*\*['"]\s*\)/,
    'server/vitest.config.ts must exclude test/contracts/** when contract opt-in is off',
  );
});
