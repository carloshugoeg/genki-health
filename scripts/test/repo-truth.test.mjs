import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

test('e2_is_explicitly_allowed', () => {
  const agents = read('AGENTS.md');
  assert.match(
    agents,
    /Current phase:\s*Entrega II/i,
    'AGENTS.md must declare Entrega II as the current phase',
  );
  assert.doesNotMatch(
    agents,
    /documentation-only;\s*there is no application code yet/i,
    'AGENTS.md must not claim the repo is documentation-only',
  );
  assert.doesNotMatch(
    agents,
    /\*\*Current phase:\*\*\s*Entrega I/i,
    'AGENTS.md must not keep Entrega I as the current phase',
  );
  assert.match(
    agents,
    /E1-05.*parallel/i,
    'AGENTS.md must state E1-05 runs in parallel, not as an E2 gate',
  );
  assert.match(
    agents,
    /npm (ci|test|run lint|run validate)/i,
    'AGENTS.md must document working npm commands for the scaffold',
  );
  assert.match(
    agents,
    /A1[\s\S]*A15|adopted assumptions A1/i,
    'AGENTS.md must summarize the adopted A1–A15 planning defaults',
  );
});

test('auth_locks_remain_intact', () => {
  const agents = read('AGENTS.md');
  const needsHuman = read('poteto-mode/decisions/needs-human.md');
  const locked = read('poteto-mode/decisions/locked.md');

  assert.match(
    agents,
    /\*\*Auth\*\*.*login flows.*JWT claims.*password policy.*session handling/is,
    'AGENTS.md must keep Auth in the stop-and-ask list',
  );
  assert.match(
    locked,
    /## Auth \(Carlos, 2026-10-19\)/,
    'locked.md must retain the Auth lock section',
  );
  assert.match(
    locked,
    /Access TTL:\s*\*\*30 minutes\*\*/,
    'locked.md must keep the 30-minute access JWT TTL',
  );
  assert.match(
    locked,
    /Refresh TTL:\s*\*\*14 days\*\*/,
    'locked.md must keep the 14-day refresh TTL',
  );
  assert.match(
    locked,
    /Argon2id/,
    'locked.md must keep Argon2id as the password hash',
  );
  assert.match(
    needsHuman,
    /No open needs-human Auth items remain/,
    'needs-human.md must keep Auth closed by Carlos, not reopen it',
  );
});

test('gate_has_protocol_and_security_items', () => {
  const path = join(root, 'docs/gate-checklist.md');
  assert.ok(existsSync(path), 'docs/gate-checklist.md must exist');
  const gate = read('docs/gate-checklist.md');
  for (const id of ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8']) {
    assert.match(
      gate,
      new RegExp(`\\*\\*${id}\\b`),
      `docs/gate-checklist.md must include ${id}`,
    );
  }
  assert.match(
    gate,
    /protocol-change|protocol change|protocol/i,
    'gate checklist must record protocol-change review items',
  );
  assert.match(
    gate,
    /least-privilege|credential|JWT|security|deny-by-default/i,
    'gate checklist must record security items',
  );
});
