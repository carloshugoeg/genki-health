import Fastify from 'fastify';
import { describe, it, expect, vi } from 'vitest';
import { asInstitutionId } from '@genki/shared';
import { agendaPlugin } from './agenda.js';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { AgendaRepositoryPort } from '../../../ports/full/agenda.js';

const context = {
  id_institucion: asInstitutionId(1),
  id_usuario: 1,
  id_profesional: null,
  roles: ['recepcion'],
  permissions: [],
  now: '2026-11-09T12:00:00Z',
};
const cita = {
  id_cita: 1,
  id_paciente: 1,
  id_profesional: 1,
  fecha_hora: '2026-11-09T14:00:00Z',
  duracion_minutos: 30,
  estado: 'programada',
  id_usuario_registra: 1,
  fecha_creacion: context.now,
};
function setup() {
  const repository: AgendaRepositoryPort = {
    op20: vi.fn(async () => []),
    op21: vi.fn(async () => cita),
    op22: vi.fn(async () => cita),
    op23: vi.fn(async () => ({ ...cita, estado: 'cancelada' })),
    op24: vi.fn(async () => ({ ...cita, estado: 'confirmada' })),
    op25: vi.fn(async () => [cita]),
  };
  const app = Fastify();
  app.register(agendaPlugin, {
    resolve: async (req) => {
      if (req.headers.authorization !== 'Bearer host-verified')
        throw new ClinicalError('missing_bearer', 'Se requiere sesión');
      return { repository, context };
    },
  });
  return { app, repository };
}
const headers = { authorization: 'Bearer host-verified' };
describe('Standalone agenda HTTP plugin', () => {
  it('all six paths delegate to institution-bound port and return exact response shapes', async () => {
    const { app, repository } = setup();
    try {
      const booking = {
        id_paciente: 1,
        id_profesional: 1,
        fecha_hora: cita.fecha_hora,
        duracion_minutos: 30,
      };
      expect(
        (await app.inject({ method: 'POST', url: '/api/citas', headers, payload: booking })).json(),
      ).toEqual(cita);
      expect(repository.op21).toHaveBeenCalledWith(
        { params: {}, query: {}, body: { ...booking, id_especialidad: null, motivo: null } },
        context,
      );
      expect(
        (
          await app.inject({
            url: '/api/agenda/disponibilidad?id_profesional=1&desde=2026-11-09T14:00:00Z&hasta=2026-11-09T23:00:00Z',
            headers,
          })
        ).json(),
      ).toEqual([]);
      expect(
        (
          await app.inject({ url: '/api/agenda?fecha=2026-11-09&id_profesional=1', headers })
        ).json(),
      ).toEqual([cita]);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/citas/1/reprogramacion',
            headers,
            payload: { fecha_hora: cita.fecha_hora, duracion_minutos: 30 },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/citas/1/cancelacion',
            headers,
            payload: { motivo: 'Cambio' },
          })
        ).json().estado,
      ).toBe('cancelada');
      expect(
        (await app.inject({ method: 'POST', url: '/api/citas/1/llegada', headers })).json().estado,
      ).toBe('confirmada');
    } finally {
      await app.close();
    }
  });
  it('host authentication, strict bodies, invalid query and conflict envelope', async () => {
    const { app, repository } = setup();
    try {
      expect((await app.inject({ url: '/api/agenda?fecha=2026-11-09' })).statusCode).toBe(401);
      expect(
        (await app.inject({ url: '/api/agenda?fecha=no&extra=1', headers })).json().error,
      ).toBe('invalid_query');
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/citas/1/cancelacion',
            headers,
            payload: { motivo: ' ' },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/citas/1/llegada',
            headers,
            payload: { estado: 'otro' },
          })
        ).statusCode,
      ).toBe(400);
      vi.mocked(repository.op24).mockRejectedValueOnce(
        new ClinicalError('conflict', 'Intervalo ocupado'),
      );
      expect(
        (await app.inject({ method: 'POST', url: '/api/citas/1/llegada', headers })).statusCode,
      ).toBe(409);
      expect(repository.op21).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
