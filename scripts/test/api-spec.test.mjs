import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const API = 'docs/plan/contracts/API.md';
const PORTS = 'docs/plan/contracts/PORTS-TESTS.md';
const DTO = 'docs/plan/contracts/DTO-BASELINE.ts';

function read(rel) {
  const path = join(root, rel);
  assert.ok(existsSync(path), `${rel} must exist`);
  return readFileSync(path, 'utf8');
}

const LIVE_ROUTES = [
  ['GET', '/health'],
  ['GET', '/api/auth/institutions'],
  ['POST', '/api/auth/login'],
  ['POST', '/api/auth/refresh'],
  ['POST', '/api/auth/logout'],
  ['GET', '/api/auth/me'],
  ['GET', '/api/catalogos'],
  ['POST', '/api/pacientes'],
  ['GET', '/api/pacientes'],
  ['GET', '/api/pacientes/:id'],
  ['POST', '/api/pacientes/:id/consultas'],
  ['POST', '/api/pacientes/:id/archivo'],
];

const ERROR_CODES = [
  'invalid_body',
  'invalid_query',
  'missing_bearer',
  'invalid_credentials',
  'invalid_token',
  'password_policy',
  'forbidden',
  'not_found',
  'duplicate_document',
  'guardian_required',
  'invalid_guardians',
  'expediente_archived',
  'already_archived',
  'invalid_bundle',
  'reference_not_found',
  'conflict',
  'store_unavailable',
  'misconfigured',
  'internal_error',
];

const TRANSITION_TESTS = [
  'auth_login_enters_session',
  'auth_bad_login_stays_anonymous',
  'auth_me_valid_session',
  'auth_bad_access_requires_refresh',
  'auth_refresh_rotates_once',
  'auth_refresh_replay_rejected',
  'auth_refresh_expired_rejected',
  'auth_logout_revokes_refresh',
  'auth_logout_idempotent',
  'auth_logout_bad_token_rejected',
  'auth_cannot_switch_institution',
  'register_opens_active_record',
  'register_invalid_does_not_open',
  'archive_active_record',
  'archive_invalid_reason_unchanged',
  'archive_archived_record_rejected',
  'archive_unknown_record_rejected',
  'close_on_active_record',
  'close_failure_preserves_record',
  'close_on_archived_record_rejected',
  'reactivate_route_absent',
];

test('all_live_routes_are_specified', () => {
  const api = read(API);
  const dto = read(DTO);

  assert.match(api, /## C2\.3 Route table/, 'API.md must include the C2.3 route table');
  assert.match(api, /## C2\.4 Error catalog/, 'API.md must include the C2.4 error catalog');
  assert.match(
    api,
    /pack version|e2-mvp|Frozen contract C2/i,
    'API.md must identify itself as frozen contract C2',
  );

  for (const [method, path] of LIVE_ROUTES) {
    const row = new RegExp(`${method}\\s+${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    assert.match(api, row, `API.md must specify live route ${method} ${path}`);
  }

  for (const code of ERROR_CODES) {
    assert.match(
      api,
      new RegExp(`\\|\\s*${code}\\s*\\|`),
      `API.md error catalog must list ${code}`,
    );
  }

  assert.match(
    dto,
    /export interface AccessTokenClaims/,
    'DTO-BASELINE.ts must retain AccessTokenClaims',
  );
  assert.match(
    dto,
    /export interface LoginRequestDto/,
    'DTO-BASELINE.ts must retain LoginRequestDto',
  );
  assert.match(dto, /export interface PacienteDto/, 'DTO-BASELINE.ts must retain PacienteDto');
  assert.match(dto, /export interface ExpedienteDto/, 'DTO-BASELINE.ts must retain ExpedienteDto');
});

test('ports_include_atomic_close_and_logout', () => {
  const ports = read(PORTS);

  assert.match(ports, /## C3\.1 Port signatures/, 'PORTS-TESTS.md must include C3.1');
  assert.match(
    ports,
    /export interface ConsultaRepositoryPort/,
    'PORTS-TESTS.md must declare ConsultaRepositoryPort',
  );
  assert.match(
    ports,
    /closeConsulta\(bundle:\s*CloseConsultaBundle\)/,
    'PORTS-TESTS.md must keep atomic closeConsulta(bundle)',
  );
  assert.match(ports, /export interface AuthPort/, 'PORTS-TESTS.md must declare AuthPort');
  assert.match(
    ports,
    /logout\(refreshToken:\s*string\):\s*Promise<void>/,
    'PORTS-TESTS.md must add AuthPort.logout',
  );
  assert.match(
    ports,
    /export interface IdentityStorePort/,
    'PORTS-TESTS.md must declare IdentityStorePort',
  );
  assert.match(
    ports,
    /export interface CatalogoRepositoryPort/,
    'PORTS-TESTS.md must declare CatalogoRepositoryPort',
  );
  assert.doesNotMatch(
    ports,
    /stageConsulta\s*\(|savePartialConsulta\s*\(/,
    'PORTS-TESTS.md must not introduce staged consultation write methods',
  );
});

test('state_transitions_have_test_names', () => {
  const ports = read(PORTS);

  assert.match(ports, /## C3\.5 State transition tables/, 'PORTS-TESTS.md must include C3.5');
  for (const name of TRANSITION_TESTS) {
    assert.match(
      ports,
      new RegExp(`\\|\\s*${name}\\s*\\|?`),
      `PORTS-TESTS.md C3.5 must name transition test ${name}`,
    );
  }
});
