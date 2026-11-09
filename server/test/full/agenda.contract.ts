import { describe, it, expect, beforeEach } from 'vitest';
import { randomInt } from 'node:crypto';
import { asInstitutionId } from '@genki/shared';
import type { AgendaRepositoryPort } from '../../src/ports/full/agenda.js';
import type { OperationContext } from '../../src/ports/full/context.js';

export const defaultContext: OperationContext = {
  id_institucion: asInstitutionId(1),
  id_usuario: 1,
  id_profesional: null,
  roles: ['medico'],
  permissions: [],
  now: '2026-11-09T12:00:00.000Z',
};
export const booking = {
  id_paciente: 1,
  id_profesional: 10,
  fecha_hora: '2026-11-09T14:00:00.000Z',
  duracion_minutos: 60,
  motivo: 'Privado',
};
const request = (body: typeof booking) => ({ params: {}, query: {}, body });
export function agendaContract(name: string, create: () => Promise<AgendaRepositoryPort>) {
  describe(name, () => {
    let context: OperationContext;
    beforeEach(() => {
      context = {
        ...defaultContext,
        id_institucion: asInstitutionId(randomInt(10000, 1000000000)),
      };
    });
    it('OP20–21: UTC availability, partial overlap, adjacency, concurrent booking and institution isolation', async () => {
      const repo = await create();
      const cita = await repo.op21(request(booking), context);
      const results = await Promise.allSettled([
        repo.op21(request({ ...booking, fecha_hora: '2026-11-09T14:30:00Z' }), context),
        repo.op21(request({ ...booking, fecha_hora: '2026-11-09T15:00:00Z' }), context),
        repo.op21(request({ ...booking, fecha_hora: '2026-11-09T15:00:00Z' }), context),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const slots = await repo.op20(
        {
          params: {},
          query: {
            id_profesional: 10,
            desde: '2026-11-09T14:00:00Z',
            hasta: '2026-11-09T23:00:00Z',
          },
          body: {},
        },
        context,
      );
      expect(slots[0]?.inicio).toBe('2026-11-09T16:00:00.000Z');
      expect(cita.estado).toBe('programada');
      expect(
        await repo.op25(
          { params: {}, query: { fecha: '2026-11-09' }, body: {} },
          { ...context, id_institucion: asInstitutionId(2) },
        ),
      ).toEqual([]);
    });
    it('OP22–23: reschedule conflict retains original, cancellation retains record and frees interval', async () => {
      const repo = await create();
      const first = await repo.op21(request(booking), context);
      await repo.op21(request({ ...booking, fecha_hora: '2026-11-09T16:00:00Z' }), context);
      const change = (fecha_hora: string) => ({
        params: { id: first.id_cita },
        query: {},
        body: { fecha_hora, duracion_minutos: 60 },
      });
      await expect(repo.op22(change('2026-11-09T16:30:00Z'), context)).rejects.toMatchObject({
        code: 'conflict',
      });
      expect(
        (await repo.op25({ params: {}, query: { fecha: '2026-11-09' }, body: {} }, context))[0]
          ?.fecha_hora,
      ).toBe(booking.fecha_hora);
      expect((await repo.op22(change('2026-11-09T18:00:00Z'), context)).fecha_hora).toBe(
        '2026-11-09T18:00:00.000Z',
      );
      expect(
        (
          await repo.op23(
            { params: { id: first.id_cita }, query: {}, body: { motivo: 'Cambio' } },
            context,
          )
        ).estado,
      ).toBe('cancelada');
      await repo.op21(request({ ...booking, fecha_hora: '2026-11-09T18:00:00Z' }), context);
      expect(
        await repo.op25({ params: {}, query: { fecha: '2026-11-09' }, body: {} }, context),
      ).toHaveLength(3);
    });
    it('OP24–25: idempotent arrival, half-open Guatemala day, safe role projection and invalid query', async () => {
      const repo = await create();
      const cita = await repo.op21(
        request({ ...booking, fecha_hora: '2026-11-10T05:30:00Z' }),
        context,
      );
      const arrival = { params: { id: cita.id_cita }, query: {}, body: {} };
      expect((await repo.op24(arrival, context)).estado).toBe('confirmada');
      expect(await repo.op24(arrival, context)).toEqual(await repo.op24(arrival, context));
      const query = { params: {}, query: { fecha: '2026-11-09' }, body: {} };
      for (const role of ['administrador', 'auditor', 'recepcion'])
        expect((await repo.op25(query, { ...context, roles: [role] }))[0]).not.toHaveProperty(
          'motivo',
        );
      expect(
        (await repo.op25(query, { ...context, roles: ['recepcionista'] }))[0],
      ).not.toHaveProperty('motivo');
      expect((await repo.op25(query, context))[0]?.motivo).toBe('Privado');
      await expect(
        repo.op25({ ...query, query: { fecha: '2026-02-30' } }, context),
      ).rejects.toMatchObject({ code: 'invalid_query' });
      expect(
        (
          await repo.op22(
            {
              params: { id: cita.id_cita },
              query: {},
              body: { fecha_hora: cita.fecha_hora, duracion_minutos: cita.duracion_minutos },
            },
            context,
          )
        ).estado,
      ).toBe('programada');
    });
  });
}
