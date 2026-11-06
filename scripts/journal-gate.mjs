#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const CODE_PREFIXES = ['server/', 'web/', 'shared/'];
const JOURNAL_PREFIX = 'docs/progress/journal/';
const ZERO_OID = /^0+$/;

function usage() {
  return 'usage: node scripts/journal-gate.mjs --base <sha-or-ref> --head <sha-or-ref>';
}

function parseArgs(argv) {
  let base;
  let head;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base') {
      base = argv[++i];
    } else if (arg === '--head') {
      head = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      return { help: true };
    } else {
      throw new Error(`${usage()}\nunknown argument: ${arg}`);
    }
  }
  if (!base || !head) {
    throw new Error(usage());
  }
  return { base, head };
}

function git(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed (status ${result.status}): ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

function emptyTreeOid(cwd) {
  return git(cwd, ['hash-object', '-t', 'tree', '/dev/null']);
}

function resolveRef(cwd, ref) {
  if (ZERO_OID.test(ref)) {
    return emptyTreeOid(cwd);
  }
  return git(cwd, ['rev-parse', '--verify', ref]);
}

function listNames(cwd, base, head, extraArgs = []) {
  const out = git(cwd, ['diff', ...extraArgs, '--name-only', `${base}...${head}`]);
  return out === '' ? [] : out.split('\n');
}

export function evaluateJournalGate({ cwd = process.cwd(), base, head } = {}) {
  if (!base || !head) {
    throw new Error('base and head are required');
  }
  const resolvedBase = resolveRef(cwd, base);
  const resolvedHead = resolveRef(cwd, head);
  const changed = listNames(cwd, resolvedBase, resolvedHead);
  const added = listNames(cwd, resolvedBase, resolvedHead, ['--diff-filter=A']);

  const touchesCode = changed.some((path) =>
    CODE_PREFIXES.some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix)),
  );
  const addedJournal = added.some((path) => path.startsWith(JOURNAL_PREFIX));

  if (touchesCode && !addedJournal) {
    return {
      ok: false,
      message:
        'PRs touching server/, web/, or shared/ must add a new file under docs/progress/journal/ (edited historical journals do not count)',
    };
  }
  return { ok: true, message: 'journal gate ok' };
}

export function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const result = evaluateJournalGate({ cwd, base: parsed.base, head: parsed.head });
  if (!result.ok) {
    process.stderr.write(`${result.message}\n`);
    return 1;
  }
  process.stdout.write(`${result.message}\n`);
  return 0;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
