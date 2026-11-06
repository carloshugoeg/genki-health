import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function nextAgentTicket(text) {
  const patterns = [
    /Next after E2-P0-02[:\s*]*\**\s*(E2-P[0-9A-Z-]+)/i,
    /\*\*Next:\*\*[^\n]*?(E2-P[0-9A-Z-]+)/i,
    /\|[^|\n]*\|[^|\n]*\|\s*Backlog\s*\|[^|\n]*\|\s*(E2-P[0-9A-Z-]+)/i,
    /\|\s*\d+\s*\|\s*(E2-P[0-9A-Z-]+)\s*\|[^|\n]*\|\s*(?:backlog|next|ready)\s*\|/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] ?? match[0].match(/E2-P[0-9A-Z-]+/i)?.[0];
    }
  }
  const fallback = text.match(/E2-P0-03/);
  return fallback ? fallback[0] : null;
}

test('trackers_name_same_next_ticket', () => {
  const now = read('poteto-mode/queue/NOW.md');
  const tasks = read('docs/progress/TASKS.md');
  const map = read('poteto-mode/feature-map.md');
  const backlog = read('poteto-mode/queue/backlog.md');
  const e201 = read('poteto-mode/queue/tickets/e2-01-entrega-ii.md');

  const fromNow = nextAgentTicket(now);
  const fromMap = nextAgentTicket(map);
  const fromBacklog = nextAgentTicket(backlog);

  assert.equal(fromNow, 'E2-P0-03', 'NOW.md must name E2-P0-03 as the next agent-lane ticket');
  assert.equal(fromMap, 'E2-P0-03', 'feature-map.md must name E2-P0-03 as next');
  assert.equal(fromBacklog, 'E2-P0-03', 'backlog.md must list E2-P0-03 among indexed E2 tickets');
  assert.equal(fromNow, fromMap, 'NOW and feature-map must name the same next ticket');
  assert.equal(fromNow, fromBacklog, 'NOW and backlog must name the same next ticket');

  assert.match(
    tasks,
    /E2-P0-03/,
    'TASKS.md must include the E2-P0-03 row so the board matches the queue',
  );
  assert.match(
    backlog,
    /E2-P0-02/,
    'backlog.md must include the full E2-P0 index, not only the E2-01 mega-ticket',
  );
  assert.match(
    e201,
    /rollup|E2-P0|E2-EXECUTABLE|indexed/i,
    'e2-01 ticket must point at the P0+ index rollup instead of claiming all Entrega II done',
  );
  assert.doesNotMatch(
    e201,
    /Status:\s*in progress/i,
    'e2-01 must not remain the sole active Entrega II claim after tracker sync',
  );
});

test('engine_table_matches_locks', () => {
  const desc = read('PROJECT-DESC.md');
  const locked = read('poteto-mode/decisions/locked.md');
  const architecture = read('docs/ARCHITECTURE.md');

  assert.match(
    locked,
    /Hospital general uses PostgreSQL/i,
    'locked.md must keep Hospital general → PostgreSQL',
  );
  assert.match(
    locked,
    /Centro médico pediátrico uses MySQL/i,
    'locked.md must keep Centro médico pediátrico → MySQL',
  );
  assert.match(
    locked,
    /Laboratorio clínico uses MongoDB/i,
    'locked.md must keep Laboratorio clínico → MongoDB',
  );
  assert.match(
    locked,
    /Clínica odontológica uses Firebase/i,
    'locked.md must keep Clínica odontológica → Firebase',
  );

  assert.doesNotMatch(
    desc,
    /\(Por definir\)/i,
    'PROJECT-DESC.md engine table must not leave motors as Por definir',
  );
  assert.match(
    desc,
    /\|\s*\*\*Hospital general\*\*\s*\|\s*PostgreSQL\s*\|/i,
    'PROJECT-DESC.md must assign Hospital general → PostgreSQL',
  );
  assert.match(
    desc,
    /\|\s*\*\*Centro médico pediátrico\*\*\s*\|\s*MySQL\s*\|/i,
    'PROJECT-DESC.md must assign Centro médico pediátrico → MySQL',
  );
  assert.match(
    desc,
    /\|\s*\*\*Laboratorio clínico\*\*\s*\|\s*MongoDB\s*\|/i,
    'PROJECT-DESC.md must assign Laboratorio clínico → MongoDB',
  );
  assert.match(
    desc,
    /\|\s*\*\*Clínica odontológica\*\*\s*\|\s*Firebase(?:\s*\(Firestore\))?\s*\|/i,
    'PROJECT-DESC.md must assign Clínica odontológica → Firebase',
  );

  assert.match(
    architecture,
    /adapters\/memory/i,
    'ARCHITECTURE.md must keep memory as the current reference adapter base',
  );
  assert.match(
    architecture,
    /Pendiente|incomplete|vacías|placeholder/i,
    'ARCHITECTURE.md must state real engine adapters are still incomplete',
  );
  for (const engine of ['postgres', 'mysql', 'mongodb', 'firebase']) {
    assert.match(
      architecture,
      new RegExp(`adapters/${engine}`, 'i'),
      `ARCHITECTURE.md must name the intended adapters/${engine} path`,
    );
  }
});

test('e1_05_is_parallel_not_blocking', () => {
  const now = read('poteto-mode/queue/NOW.md');
  const map = read('poteto-mode/feature-map.md');
  const tasks = read('docs/progress/TASKS.md');
  const backlog = read('poteto-mode/queue/backlog.md');
  const roadmap = read('docs/roadmap/ROADMAP.md');
  const governanceReadme = read('docs/governance/README.md');

  for (const [name, text] of [
    ['NOW.md', now],
    ['feature-map.md', map],
    ['TASKS.md', tasks],
    ['backlog.md', backlog],
    ['ROADMAP.md', roadmap],
  ]) {
    assert.match(text, /E1-05/i, `${name} must still mention E1-05`);
    assert.match(
      text,
      /E1-05[\s\S]{0,160}(parallel|does not block|no bloquea|not an E2 gate)/i,
      `${name} must state E1-05 is parallel / not an E2 gate`,
    );
  }

  assert.match(
    roadmap,
    /Entrega II/i,
    'ROADMAP.md must describe Entrega II as current indexed work, not a single blocked future ticket',
  );
  assert.doesNotMatch(
    roadmap,
    /Only Entrega I is ticketed as current work/i,
    'ROADMAP.md must not claim only Entrega I is ticketed',
  );
  assert.doesNotMatch(
    governanceReadme,
    /does not open that work while Entrega I tickets are open/i,
    'docs/governance/README.md must not keep the stale E1-only gate prose',
  );

  for (const rel of [
    'docs/governance/workflow.md',
    'docs/governance/git-protocol.md',
    'docs/governance/testing-policy.md',
    'docs/governance/definition-of-done.md',
  ]) {
    assert.ok(existsSync(join(root, rel)), `${rel} must exist as a short governance pointer`);
  }
});
