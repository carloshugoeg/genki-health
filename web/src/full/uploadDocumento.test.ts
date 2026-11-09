import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { uploadDocumento } from '../api';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  const store = new Map<string, string>([['genki.access_token', 'test-access']]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it('upload_documento_posts_json_with_idempotency_key', async () => {
  const fetchMock = vi.fn(async () => json({ id_documento: 7 }, 201));
  vi.stubGlobal('fetch', fetchMock);
  await uploadDocumento(101, {
    archivo_base64: 'JVBERg==',
    tipo_mime: 'application/pdf',
    nombre_archivo: 'informe.pdf',
  });
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('/api/pacientes/101/documentos');
  const headers = new Headers(init.headers);
  expect(headers.get('Idempotency-Key')).toMatch(/^.{1,80}$/);
  expect(headers.get('Content-Type')).toBe('application/json');
  expect(JSON.parse(String(init.body))).toEqual({
    archivo_base64: 'JVBERg==',
    tipo_mime: 'application/pdf',
    nombre_archivo: 'informe.pdf',
  });
});

it('transport_errors_have_spanish_messages', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json({ error: 'payload_too_large', message: 'x' }, 413)),
  );
  await expect(
    uploadDocumento(1, { archivo_base64: 'AA==', tipo_mime: 'image/png', nombre_archivo: 'a.png' }),
  ).rejects.toMatchObject({
    code: 'payload_too_large',
    status: 413,
    message: 'El archivo o la solicitud excede el tamaño permitido',
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json({ error: 'unsupported_media_type', message: 'x' }, 415)),
  );
  await expect(
    uploadDocumento(1, { archivo_base64: 'AA==', tipo_mime: 'image/png', nombre_archivo: 'a.png' }),
  ).rejects.toMatchObject({
    code: 'unsupported_media_type',
    message: 'Tipo de contenido no soportado',
  });
});
