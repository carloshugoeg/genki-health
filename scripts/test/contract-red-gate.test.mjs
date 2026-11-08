import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function workflowJob(ci, name) {
  const start = ci.search(new RegExp(`^ {2}${name}:`, 'm'));
  if (start < 0) return null;
  const fromJob = ci.slice(start);
  const next = fromJob.search(/\n {2}[A-Za-z][\w-]*:/);
  return next < 0 ? fromJob : fromJob.slice(0, next);
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
  const jobBody = workflowJob(ci, 'contract-red');
  assert.ok(jobBody, 'ci.yml must declare a contract-red job separate from validate');
  assert.match(
    jobBody,
    /expect-contract-red\.sh|test:contract-red|CONTRACT_RED/,
    'contract-red job steps must run the expect script or CONTRACT_RED expected-red reporter',
  );
});

test('validate_tests_step_stays_plain_npm_test', () => {
  const ci = read('.github/workflows/ci.yml');
  const validateBody = workflowJob(ci, 'validate');
  assert.ok(validateBody, 'ci.yml must declare a validate job');
  assert.match(
    validateBody,
    /name:\s*Tests[\s\S]*?run:\s*npm test\b/,
    'validate job Tests step must remain plain npm test',
  );
  assert.doesNotMatch(
    validateBody,
    /name:\s*Tests[\s\S]*?CONTRACT_RED\s*=\s*1/,
    'validate job Tests step must not set CONTRACT_RED=1',
  );
});

test('vitest_keeps_contract_discovery_gate', () => {
  const config = read('server/vitest.config.ts');
  assert.match(
    config,
    /process\.env\.CONTRACT_RED\s*===\s*['"]1['"]\s*\|\|\s*process\.env\.CONTRACT_READY\s*===\s*['"]1['"]/,
    'server/vitest.config.ts must opt into contracts only when CONTRACT_RED=1 or CONTRACT_READY=1',
  );
  assert.match(
    config,
    /exclude\.push\(\s*['"]test\/contracts\/\*\*['"]\s*\)/,
    'server/vitest.config.ts must exclude test/contracts/** when contract opt-in is off',
  );
});
