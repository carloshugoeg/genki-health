import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api, ApiError, login, logout, registerPaciente } from './api';
import { clearSession, loadSession, saveSession } from './session';
import { MVP_PATHS, route } from './router';
import type { AuthTokensDto, RegisterPacienteRequest } from '@genki/shared';
const tokens = (suffix: string): AuthTokensDto => ({
  access_token: `test-access-${suffix}`,
  refresh_token: `test-refresh-${suffix}`,
  token_type: 'Bearer',
  expires_in: 1800,
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
let store: Map<string, string>;
const replace = vi.fn();
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  vi.stubGlobal('window', {
    history: { replaceState: replace, pushState: vi.fn() },
    dispatchEvent: vi.fn(),
  });
  vi.stubGlobal('PopStateEvent', Event);
  saveSession(tokens('old'), 'hospital_general');
});
afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it('api_attaches_bearer_and_refreshes_once', async () => {
  let refreshes = 0;
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/refresh')) {
      refreshes++;
      await Promise.resolve();
      return json(tokens('new'));
    }
    const header = new Headers(init.headers).get('Authorization');
    expect(['Bearer test-access-old', 'Bearer test-access-new']).toContain(header);
    return header === 'Bearer test-access-old'
      ? json({ error: 'invalid_token' }, 401)
      : json({ ok: true });
  });
  vi.stubGlobal('fetch', fetchMock);
  expect(await Promise.all([api('/api/pacientes'), api('/api/catalogos')])).toEqual([
    { ok: true },
    { ok: true },
  ]);
  expect(refreshes).toBe(1);
  expect(fetchMock).toHaveBeenCalledTimes(5);
  expect(loadSession().refresh_token).toBe('test-refresh-new');
});
it('logout_clears_session_even_on_network_error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
  await expect(logout()).rejects.toThrow('network');
  expect(loadSession()).toEqual({
    access_token: null,
    refresh_token: null,
    institution_kind: null,
  });
  expect(replace).toHaveBeenCalledWith(null, '', '/login');
});
it('register_omits_engine_and_institution', async () => {
  const input = {
    tipo_documento: 'DPI',
    numero_documento: 'EXAMPLE',
    primer_nombre: 'Ejemplo',
    primer_apellido: 'Prueba',
    fecha_nacimiento: '2000-01-01',
    sexo: 'X',
    motor: 'mysql',
    id_institucion: 2,
    institution_kind: 'centro_pediatrico',
  };
  const fetchMock = vi.fn().mockResolvedValue(json({ paciente: { id_paciente: 1 } }, 201));
  vi.stubGlobal('fetch', fetchMock);
  await registerPaciente(input as RegisterPacienteRequest);
  const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
  expect(body).toEqual({
    tipo_documento: 'DPI',
    numero_documento: 'EXAMPLE',
    primer_nombre: 'Ejemplo',
    primer_apellido: 'Prueba',
    fecha_nacimiento: '2000-01-01',
    sexo: 'X',
  });
});
it('router_has_exact_mvp_paths', () => {
  expect(MVP_PATHS).toEqual([
    '/',
    '/inicio',
    '/login',
    '/panel',
    '/pacientes',
    '/pacientes/nuevo',
    '/pacientes/:id',
    '/pacientes/:id/consulta/nueva',
    '/agenda',
    '/economia',
    '/inventario',
    '/honorarios',
    '/facturacion',
    '/caja',
    '/personal',
    '/procedimientos',
    '/sesiones-dentales',
    '/cuenta',
    '/usuarios',
  ]);
  expect(route('/')).toBe('home');
  expect(route('/inicio')).toBe('home');
  expect(route('/cuenta')).toBe('cuenta');
  expect(route('/usuarios')).toBe('usuarios');
  expect(
    [
      '/',
      '/inicio',
      '/login',
      '/panel',
      '/pacientes',
      '/pacientes/nuevo',
      '/pacientes/12',
      '/pacientes/12/consulta/nueva',
      '/agenda',
      '/economia',
    ].map(route),
  ).toEqual([
    'home',
    'home',
    'login',
    'panel',
    'patients',
    'register',
    'record',
    'consultation',
    'agenda',
    'economia',
  ]);
  expect(route('/pacientes/0')).toBe('unknown');
  expect(route('/other')).toBe('unknown');
});
it('failed_refresh_clears_session_without_retry_loop', async () => {
  const fetchMock = vi.fn().mockResolvedValue(json({ error: 'invalid_token' }, 401));
  vi.stubGlobal('fetch', fetchMock);
  await expect(api('/api/pacientes')).rejects.toMatchObject({ code: 'invalid_token', status: 401 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(loadSession().access_token).toBeNull();
});
it('second_401_clears_session_after_one_retry', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json({ error: 'invalid_token' }, 401))
    .mockResolvedValueOnce(json(tokens('new')))
    .mockResolvedValueOnce(json({ error: 'invalid_token' }, 401));
  vi.stubGlobal('fetch', fetchMock);
  await expect(api('/api/pacientes')).rejects.toBeInstanceOf(ApiError);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(loadSession().access_token).toBeNull();
});
it('duplicate_document_is_safe_and_keeps_session', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(json({ error: 'duplicate_document', message: 'unsafe driver text' }, 409)),
  );
  await expect(api('/api/pacientes')).rejects.toMatchObject({
    code: 'duplicate_document',
    status: 409,
    message: 'Documento ya registrado en esta institución',
  });
  expect(loadSession().access_token).not.toBeNull();
});
it('login_does_not_refresh_invalid_credentials', async () => {
  const fetchMock = vi.fn().mockResolvedValue(json({ error: 'invalid_credentials' }, 401));
  vi.stubGlobal('fetch', fetchMock);
  await expect(
    login({ email: '', password: '', institution_kind: 'hospital_general' }),
  ).rejects.toMatchObject({ code: 'invalid_credentials' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(loadSession().access_token).toBeNull();
});
