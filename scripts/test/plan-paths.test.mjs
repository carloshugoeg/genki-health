import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const INDEX = 'docs/plan/tickets/index.json';
const EXECUTABLE = 'docs/plan/E2-EXECUTABLE.md';

const CONTRACT_LINKS = [
  'docs/plan/contracts/API.md',
  'docs/plan/contracts/CORE.md',
  'docs/plan/contracts/DOCUMENTS-SECURITY.md',
  'docs/plan/contracts/DTO-BASELINE.ts',
  'docs/plan/contracts/PORTS-TESTS.md',
  'docs/plan/contracts/SQL.md',
  'docs/plan/contracts/mongodb-schema.json',
  'docs/plan/ddl/mysql.sql',
  'docs/plan/ddl/postgres.sql',
  'docs/gate-checklist.md',
  'docs/plan/tickets/index.json',
];

function read(rel) {
  const path = join(root, rel);
  assert.ok(existsSync(path), `${rel} must exist`);
  return readFileSync(path, 'utf8');
}

function loadIndex() {
  const raw = read(INDEX);
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed.tickets), 'index.json tickets must be an array');
  assert.ok(parsed.created_by && typeof parsed.created_by === 'object', 'index.json created_by must be an object');
  assert.ok(Array.isArray(parsed.existing_on_pr9), 'index.json existing_on_pr9 must be an array');
  return parsed;
}

function predecessors(ticketId, byId) {
  const seen = new Set();
  const stack = [...(byId.get(ticketId)?.deps ?? [])];
  while (stack.length > 0) {
    const dep = stack.pop();
    if (seen.has(dep)) continue;
    seen.add(dep);
    const node = byId.get(dep);
    assert.ok(node, `dependency ${dep} of ${ticketId} must be indexed`);
    stack.push(...node.deps);
  }
  return seen;
}

test('every_ticket_dependency_precedes_consumer', () => {
  const index = loadIndex();
  const order = new Map(index.tickets.map((ticket, i) => [ticket.id, i]));

  for (const ticket of index.tickets) {
    assert.ok(typeof ticket.id === 'string' && ticket.id.length > 0, 'ticket id must be non-empty');
    assert.ok(Array.isArray(ticket.deps), `${ticket.id} deps must be an array`);
    for (const dep of ticket.deps) {
      assert.ok(order.has(dep), `${ticket.id} dependency ${dep} must appear in the ticket index`);
      assert.ok(
        order.get(dep) < order.get(ticket.id),
        `${dep} must precede consumer ${ticket.id} in docs/plan/tickets/index.json`,
      );
    }
  }
});

test('every_contract_link_resolves', () => {
  const executable = read(EXECUTABLE);

  assert.match(
    executable,
    /docs\/plan\/tickets\/index\.json/,
    'E2-EXECUTABLE.md must link the ticket index path',
  );
  assert.match(
    executable,
    /docs\/gate-checklist\.md/,
    'E2-EXECUTABLE.md must link the gate checklist',
  );

  for (const rel of CONTRACT_LINKS) {
    assert.match(
      executable,
      new RegExp(rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `E2-EXECUTABLE.md must reference ${rel}`,
    );
    assert.ok(existsSync(join(root, rel)), `${rel} must exist on disk`);
  }
});

test('every_created_path_has_owner', () => {
  const index = loadIndex();
  const byId = new Map(index.tickets.map((ticket) => [ticket.id, ticket]));
  const existing = new Set(index.existing_on_pr9);

  for (const [path, owner] of Object.entries(index.created_by)) {
    assert.ok(byId.has(owner), `created_by owner ${owner} for ${path} must be a ticket id`);
  }

  for (const ticket of index.tickets) {
    assert.ok(Array.isArray(ticket.files), `${ticket.id} files must be an array`);
    const preds = predecessors(ticket.id, byId);
    for (const file of ticket.files) {
      if (existing.has(file)) continue;
      const owner = index.created_by[file];
      assert.ok(
        owner,
        `${file} listed by ${ticket.id} is not on the PR9 baseline and must have a created_by owner`,
      );
      assert.ok(
        owner === ticket.id || preds.has(owner),
        `${file} owner ${owner} must be ${ticket.id} or a dependency predecessor`,
      );
    }
  }
});
