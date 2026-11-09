import { it, expect } from 'vitest';
import {
  MemoryAgendaRepository,
  MemoryAgendaStore,
} from '../../../src/adapters/memory/full/agenda.js';
import { booking, defaultContext as context } from '../agenda.contract.js';
const query = (desde: string, hasta: string) => ({
  params: {},
  query: { id_profesional: 10, desde, hasta },
  body: {},
});
it('availability bounds, Sunday exclusion, configurable academic hours and malformed input', async () => {
  const repository = new MemoryAgendaRepository();
  expect(
    await repository.op20(query('2026-11-08T00:00:00Z', '2026-11-09T06:00:00Z'), context),
  ).toEqual([]);
  expect(
    await repository.op20(query('2026-11-09T14:10:00Z', '2026-11-09T15:00:00Z'), context),
  ).toEqual([
    { id_profesional: 10, inicio: '2026-11-09T14:30:00.000Z', fin: '2026-11-09T15:00:00.000Z' },
  ]);
  for (const input of [
    query('2026-11-09T00:00:00Z', '2026-12-11T00:00:00Z'),
    query('2026-11-09T00:00:00Z', '2026-11-09T00:00:00Z'),
    query('2026-02-30T00:00:00Z', '2026-03-02T00:00:00Z'),
  ])
    await expect(repository.op20(input, context)).rejects.toMatchObject({ code: 'invalid_query' });
  await expect(
    repository.op21({ params: {}, query: {}, body: { ...booking, duracion_minutos: 0 } }, context),
  ).rejects.toMatchObject({ code: 'invalid_body' });
  const custom = new MemoryAgendaRepository(new MemoryAgendaStore(), {
    hours: { startHour: 10, endHour: 11, slotMinutes: 60 },
  });
  expect(
    await custom.op20(query('2026-11-09T06:00:00Z', '2026-11-10T06:00:00Z'), context),
  ).toHaveLength(1);
});
it('mid-write rollback restores old day, and no_asistio/cancelled intervals are reusable', async () => {
  const store = new MemoryAgendaStore(),
    repository = new MemoryAgendaRepository(store);
  const old = await repository.op21(
    { params: {}, query: {}, body: { ...booking, fecha_hora: '2026-11-10T05:30:00Z' } },
    context,
  );
  const failing = new MemoryAgendaRepository(store, {
    afterWrite: () => {
      throw new Error('injected');
    },
  });
  await expect(
    failing.op22(
      {
        params: { id: old.id_cita },
        query: {},
        body: { fecha_hora: '2026-11-11T14:00:00Z', duracion_minutos: 30 },
      },
      context,
    ),
  ).rejects.toThrow('injected');
  await expect(
    repository.op21(
      { params: {}, query: {}, body: { ...booking, fecha_hora: '2026-11-10T06:00:00Z' } },
      context,
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
  await store.transaction(context.id_institucion, [], async (tx) =>
    tx.put({ ...old, estado: 'no_asistio' }),
  );
  await repository.op21(
    { params: {}, query: {}, body: { ...booking, fecha_hora: '2026-11-10T06:00:00Z' } },
    context,
  );
  await expect(
    repository.op24({ params: { id: old.id_cita }, query: {}, body: {} }, context),
  ).rejects.toMatchObject({ code: 'conflict' });
  await expect(
    repository.op23(
      { params: { id: old.id_cita }, query: {}, body: { motivo: 'Motivo' } },
      context,
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
});
