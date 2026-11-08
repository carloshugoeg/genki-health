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
    `^ {2}${jobName}:\\s*\\n([\\s\\S]*?)(?=\\n {2}[a-zA-Z0-9_-]+:\\s*\\n|(?![\\s\\S]))`,
    'm',
  );
  const match = ci.match(re);
  assert.ok(match, `ci.yml must declare a ${jobName} job`);
  return match[1];
}

test('memory_contract_is_in_default_vitest_include', () => {
  const config = read('server/vitest.config.ts');
  assert.doesNotMatch(config, /CONTRACT_RED/, 'CONTRACT_RED opt-in must be removed after P2-06');
  assert.doesNotMatch(
    config,
    /exclude\.push\(\s*['"]test\/contracts\/\*\*['"]\s*\)/,
    'default vitest must not exclude all test/contracts/**',
  );
  assert.match(
    config,
    /test\/contracts\/memory\.test\.ts|include:.*test\/\*\*\/\*\.test\.ts/s,
    'memory contract runner must be discoverable by default include',
  );
});

test('expect_contract_red_script_runs_green_suite', () => {
  const path = join(root, 'scripts/expect-contract-red.sh');
  assert.ok(existsSync(path), 'compat wrapper scripts/expect-contract-red.sh must exist');
  const body = read('scripts/expect-contract-red.sh');
  assert.match(body, /memory\.test\.ts/, 'wrapper must run the memory contract suite');
  assert.doesNotMatch(
    body,
    /expected non-zero/,
    'wrapper must not expect the suite to stay red after P2-06',
  );
});

test('package_json_exposes_test_contract_red_compat', () => {
  const pkg = JSON.parse(read('package.json'));
  const scripts = pkg.scripts ?? {};
  const contractRed = Object.entries(scripts).find(([, cmd]) =>
    String(cmd).includes('expect-contract-red.sh'),
  );
  assert.ok(contractRed, 'package.json may keep test:contract-red as a green compat alias');
});

test('validate_tests_step_stays_plain_npm_test', () => {
  const ci = read('.github/workflows/ci.yml');
  const validateBody = jobBody(ci, 'validate');
  assert.match(
    validateBody,
    /name:\s*Tests[\s\S]*?run:\s*npm test\b/,
    'validate job Tests step must remain plain npm test (memory suite included via vitest)',
  );
});
