import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const gateScript = join(root, 'scripts', 'journal-gate.mjs');

function git(cwd, args, opts = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
    ...opts,
  });
  if ((result.status ?? 1) !== 0 && !opts.allowFail) {
    throw new Error(
      `git ${args.join(' ')} failed (status ${result.status}): ${result.stderr || result.stdout}`,
    );
  }
  return result;
}

function initRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'journal-gate-'));
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.email', 'journal-gate@example.com']);
  git(dir, ['config', 'user.name', 'Journal Gate Test']);
  mkdirSync(join(dir, 'docs', 'progress', 'journal'), { recursive: true });
  writeFileSync(join(dir, 'README.md'), 'base\n');
  writeFileSync(join(dir, 'docs', 'progress', 'journal', '2026-01-01-seed.md'), 'seed\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-m', 'base']);
  return dir;
}

function runGate(cwd, base, head) {
  assert.ok(existsSync(gateScript), 'scripts/journal-gate.mjs must exist');
  return spawnSync(process.execPath, [gateScript, '--base', base, '--head', head], {
    cwd,
    encoding: 'utf8',
  });
}

test('pr_code_without_added_journal_fails', () => {
  const dir = initRepo();
  try {
    const base = git(dir, ['rev-parse', 'HEAD']).stdout.trim();
    mkdirSync(join(dir, 'server'), { recursive: true });
    writeFileSync(join(dir, 'server', 'touch.js'), 'export {}\n');
    writeFileSync(join(dir, 'docs', 'progress', 'journal', '2026-01-01-seed.md'), 'seed edited\n');
    git(dir, ['add', '.']);
    git(dir, ['commit', '-m', 'code without added journal']);
    const head = git(dir, ['rev-parse', 'HEAD']).stdout.trim();

    const result = runGate(dir, base, head);
    assert.notEqual(
      result.status,
      0,
      'PRs that touch server/web/shared without an added journal file must fail the gate',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pr_added_journal_passes', () => {
  const dir = initRepo();
  try {
    const base = git(dir, ['rev-parse', 'HEAD']).stdout.trim();
    mkdirSync(join(dir, 'web'), { recursive: true });
    writeFileSync(join(dir, 'web', 'touch.js'), 'export {}\n');
    writeFileSync(join(dir, 'docs', 'progress', 'journal', '2026-11-06-session.md'), 'session\n');
    git(dir, ['add', '.']);
    git(dir, ['commit', '-m', 'code with added journal']);
    const head = git(dir, ['rev-parse', 'HEAD']).stdout.trim();

    const result = runGate(dir, base, head);
    assert.equal(
      result.status,
      0,
      `PRs that add a journal file alongside code changes must pass: ${result.stderr || result.stdout}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('main_push_without_origin_main_diff_passes', () => {
  const dir = initRepo();
  try {
    const before = git(dir, ['rev-parse', 'HEAD']).stdout.trim();
    mkdirSync(join(dir, 'shared'), { recursive: true });
    writeFileSync(join(dir, 'shared', 'touch.js'), 'export {}\n');
    writeFileSync(join(dir, 'docs', 'progress', 'journal', '2026-11-06-main.md'), 'main push\n');
    git(dir, ['add', '.']);
    git(dir, ['commit', '-m', 'main push with journal']);
    const head = git(dir, ['rev-parse', 'HEAD']).stdout.trim();

    const remotes = git(dir, ['remote']).stdout.trim();
    assert.equal(remotes, '', 'fixture must not depend on an origin/main remote');

    const result = runGate(dir, before, head);
    assert.equal(
      result.status,
      0,
      `main-push base/head checks must pass without origin/main: ${result.stderr || result.stdout}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
