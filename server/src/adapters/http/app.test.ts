import { describe, expect, it } from 'vitest';
import { createPhase0Auth, createPhase0Registry } from '../../config/compose-memory.js';
import { buildHttpApp } from './app.js';

describe('HTTP auth routing', () => {
  it('returns tokens from login and routes pacientes via JWT institution', async () => {
    const auth = await createPhase0Auth('test-secret-at-least-16');
    const app = buildHttpApp({ registry: createPhase0Registry(), auth });

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'hospital@genki.local',
        password: 'GenkiDev1',
        institution_kind: 'hospital_general',
      },
    });
    expect(login.statusCode).toBe(200);
    const tokens = login.json() as { access_token: string };

    const unauthorized = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      payload: {
        tipo_documento: 'DPI',
        numero_documento: '1',
        primer_nombre: 'Ana',
        primer_apellido: 'López',
        fecha_nacimiento: '1990-01-01',
        sexo: 'F',
      },
    });
    expect(unauthorized.statusCode).toBe(401);

    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${tokens.access_token}` },
      payload: {
        tipo_documento: 'DPI',
        numero_documento: '1',
        primer_nombre: 'Ana',
        primer_apellido: 'López',
        fecha_nacimiento: '1990-01-01',
        sexo: 'F',
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json() as { paciente: { id_institucion: number } };
    expect(body.paciente.id_institucion).toBe(1);
  });
});
